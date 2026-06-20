import { useState, useEffect, useCallback } from 'react';
import { authenticateUser as authUser, getUserById, getUsers, getSocieteById, updateUser, getUserSociete } from '../utils/auth/userStore';
import { PERMISSIONS, can as canDo } from '../utils/auth/permissionEngine';
import { getPlan, checkLimit } from '../utils/auth/plansManager';
import { getUsageThisMonth } from '../utils/auth/usageTracker';
import { logAction, AUDIT_ACTIONS } from '../utils/security/auditLog';
import { supabase, isSupabaseEnabled } from '../utils/supabaseClient';
import { getProfile, getUserCompanies } from '../utils/supabaseService';

const SESSION_KEY = 'sc_auth_session';

function getStoredSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (Date.now() > session.expires) {
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch { return null; }
}

function saveSession(userId, remember) {
  const session = { userId, expires: Date.now() + (remember ? 7 : 1) * 24 * 60 * 60 * 1000 };
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
}

export function useAuth() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentSociete, setCurrentSociete] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Try Supabase session first
        if (isSupabaseEnabled()) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            let profile = await getProfile(session.user.id);
            if (!profile) {
              try {
                const { data: newProfile } = await supabase.from('profiles').insert({
                  id: session.user.id, email: session.user.email,
                  nom: session.user.user_metadata?.nom || session.user.email?.split('@')[0] || '',
                  prenom: session.user.user_metadata?.prenom || '',
                }).select().single();
                profile = newProfile;
              } catch (e) { /* RLS may block */ }
            }
            if (profile) {
              const companies = await getUserCompanies(profile.id);
              const firstCompany = companies.length > 0 ? companies[0] : null;
              const user = { id: profile.id, email: profile.email, nom: profile.nom, prenom: profile.prenom, role: profile.role, plan: profile.plan, actif: true, societeId: firstCompany?.id || null };
              if (!cancelled) {
                setCurrentUser(user);
                if (firstCompany) setCurrentSociete(firstCompany);
                setInitializing(false);
                return;
              }
            }
          }
        }
        // Fallback to local session
        const session = getStoredSession();
        if (session) {
          const user = getUserById(session.userId);
          if (user && user.actif) {
            setCurrentUser(user);
            setCurrentSociete(getUserSociete(user.id));
          } else {
            clearSession();
          }
        }
      } catch (e) { /* ignore init errors */ }
      if (!cancelled) setInitializing(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email, password, remember = false) => {
    // Try Supabase signIn first
    if (isSupabaseEnabled()) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error && data?.user) {
        let profile = await getProfile(data.user.id);
        if (!profile) {
          try {
            const { data: newProfile } = await supabase.from('profiles').insert({
              id: data.user.id, email: data.user.email,
              nom: data.user.user_metadata?.nom || data.user.email?.split('@')[0] || '',
              prenom: data.user.user_metadata?.prenom || '',
            }).select().single();
            profile = newProfile;
          } catch (e) { /* RLS may block, handled below */ }
        }
        if (profile) {
          const companies = await getUserCompanies(profile.id);
          const firstCompany = companies.length > 0 ? companies[0] : null;
          const user = { id: profile.id, email: profile.email, nom: profile.nom, prenom: profile.prenom, role: profile.role, plan: profile.plan, actif: true, societeId: firstCompany?.id || null };
          setCurrentUser(user);
          if (firstCompany) setCurrentSociete(firstCompany);
          logAction(AUDIT_ACTIONS.LOGIN, { userId: user.id, email, method: 'supabase' });
          return user;
        }
      }
    }
    // Try to get Supabase user via signUp (covers: user deleted, new device, no local data)
    let supabaseUserId = null;
    let supabaseSession = null;
    if (isSupabaseEnabled()) {
      try {
        // signUp creates a new user (email free after delete) or returns session if auto-confirm
        const { data: suData, error: suErr } = await supabase.auth.signUp({
          email, password,
          options: { data: { nom: email.split('@')[0] || '', prenom: '' } }
        });
        if (!suErr && suData?.user) {
          supabaseUserId = suData.user.id;
          supabaseSession = suData.session || null;
          if (supabaseSession) {
            await supabase.auth.setSession(supabaseSession).catch((e) => console.warn('[auth] setSession failed:', e?.message));
          }
        }
      } catch (e) { /* signUp failed */ }
    }
    if (supabaseUserId) {
      // Create profile if the trigger didn't
      const existingProfile = await getProfile(supabaseUserId).catch(() => null);
      if (!existingProfile) {
        try {
          await supabase.from('profiles').insert({
            id: supabaseUserId, email, nom: email.split('@')[0] || '', prenom: '',
          }).select().single();
        } catch (e) { /* non bloquant */ }
      }
      const merged = { id: supabaseUserId, email, nom: email.split('@')[0] || '', prenom: '', role: 'admin', plan: 'free', actif: true, societeId: null, _localSocieteId: null };
      saveSession(merged.id, remember);
      setCurrentUser(merged);
      setCurrentSociete(null);
      logAction(AUDIT_ACTIONS.LOGIN, { userId: merged.id, email, method: 'supabase_signup' });
      return merged;
    }
    // Last resort: local auth (only works if user data exists in localStorage)
    const localUser = await authUser(email, password);
    if (localUser) {
      saveSession(localUser.id, remember);
      setCurrentUser(localUser);
      setCurrentSociete(getUserSociete(localUser.id));
      logAction(AUDIT_ACTIONS.LOGIN, { userId: localUser.id, email });
      return localUser;
    }
    throw new Error('Email ou mot de passe incorrect');
  }, []);

  const pinLogin = useCallback((user) => {
    if (!user || !user.actif) throw new Error('Utilisateur invalide');
    saveSession(user.id, true);
    setCurrentUser(user);
    setCurrentSociete(getUserSociete(user.id));
    logAction(AUDIT_ACTIONS.LOGIN, { userId: user.id, method: 'pin' });
    return user;
  }, []);

  const logout = useCallback(async () => {
    if (currentUser) logAction(AUDIT_ACTIONS.LOGOUT, { userId: currentUser.id });
    // Try Supabase signout
    if (isSupabaseEnabled()) await supabase.auth.signOut();
    clearSession();
    setCurrentUser(null);
    setCurrentSociete(null);
  }, [currentUser]);

  const can = useCallback((permission) => canDo(currentUser, permission), [currentUser]);

  const refreshUser = useCallback(() => {
    if (!currentUser) return;
    const user = getUserById(currentUser.id);
    if (user) {
      setCurrentUser(user);
      setCurrentSociete(getUserSociete(user.id));
    }
  }, [currentUser]);

  const checkLimitFn = useCallback((limitKey) => {
    if (!currentUser) return { allowed: false, reason: 'Non connecté' };
    return checkLimit(currentUser.plan || 'free', limitKey, getUsageThisMonth(currentUser.id, limitKey));
  }, [currentUser]);

  const isAdmin = currentUser?.role === 'admin';

  return {
    currentUser,
    currentSociete,
    initializing,
    login,
    pinLogin,
    logout,
    can,
    checkLimit: checkLimitFn,
    isAdmin,
    refreshUser,
    getPlan: () => currentUser ? getPlan(currentUser.plan) : null,
  };
}
