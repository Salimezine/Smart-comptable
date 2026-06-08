import { useState, useEffect, useCallback } from 'react';
import { authenticateUser as authUser, getUserById, getUsers, getSocieteById, updateUser, getUserSociete } from '../utils/auth/userStore';
import { PERMISSIONS, can as canDo } from '../utils/auth/permissionEngine';
import { getPlan, checkLimit } from '../utils/auth/plansManager';
import { getUsageThisMonth } from '../utils/auth/usageTracker';
import { logAction, AUDIT_ACTIONS } from '../utils/security/auditLog';

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
  const session = {
    userId,
    expires: Date.now() + (remember ? 7 : 1) * 24 * 60 * 60 * 1000
  };
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
    setInitializing(false);
  }, []);

  const login = useCallback(async (email, password, remember = false) => {
    const user = await authUser(email, password);
    if (!user) throw new Error('Email ou mot de passe incorrect');
    saveSession(user.id, remember);
    setCurrentUser(user);
    setCurrentSociete(getUserSociete(user.id));
    logAction(AUDIT_ACTIONS.LOGIN, { userId: user.id, email });
    return user;
  }, []);

  const pinLogin = useCallback((user) => {
    if (!user || !user.actif) throw new Error('Utilisateur invalide');
    saveSession(user.id, true);
    setCurrentUser(user);
    setCurrentSociete(getUserSociete(user.id));
    logAction(AUDIT_ACTIONS.LOGIN, { userId: user.id, method: 'pin' });
    return user;
  }, []);

  const logout = useCallback(() => {
    if (currentUser) {
      logAction(AUDIT_ACTIONS.LOGOUT, { userId: currentUser.id });
    }
    clearSession();
    setCurrentUser(null);
    setCurrentSociete(null);
  }, [currentUser]);

  const can = useCallback((permission) => {
    return canDo(currentUser, permission);
  }, [currentUser]);

  const refreshUser = useCallback(() => {
    if (!currentUser) return;
    const user = getUserById(currentUser.id);
    if (user) {
      setCurrentUser(user);
      setCurrentSociete(getUserSociete(user.id));
    }
  }, [currentUser]);

  const checkLimit = useCallback((limitKey) => {
    if (!currentUser) return { allowed: false, reason: 'Non connecté' };
    const planId = currentUser.plan || 'free';
    const usage = getUsageThisMonth(currentUser.id, limitKey);
    return checkLimit(planId, limitKey, usage);
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
    checkLimit,
    isAdmin,
    refreshUser,
    getPlan: () => currentUser ? getPlan(currentUser.plan) : null,
  };
}
