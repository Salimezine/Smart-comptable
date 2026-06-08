import { hashPIN } from '../security/pinManager';

const STORAGE_KEY = 'sc_users';

function getRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { users: [], societes: [], invitations: [] };
  } catch { return { users: [], societes: [], invitations: [] }; }
}

function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function generateId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'INV-';
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

export async function sha256(message) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function getAllData() { return getRaw(); }

export function getUsers() { return getRaw().users; }
export function getAllUsers() { return getRaw().users; }

export function getActiveUsers() { return getRaw().users.filter(u => u.actif); }

export function getUserById(id) { return getRaw().users.find(u => u.id === id) || null; }

export function getUserByEmail(email) { return getRaw().users.find(u => u.email === email && u.actif) || null; }

export async function authenticateUser(email, password) {
  const hash = await sha256(password);
  const user = getRaw().users.find(u => u.email === email && u.passwordHash === hash && u.actif);
  if (!user) return null;
  user.lastLogin = new Date().toISOString().split('T')[0];
  updateUser(user.id, { lastLogin: user.lastLogin });
  return user;
}

export async function createUser(data) {
  const existing = getUserByEmail(data.email);
  if (existing) return null;
  const user = {
    id: generateId('usr'),
    email: data.email || '',
    passwordHash: data.password ? await sha256(data.password) : undefined,
    pin_hash: data.pin || undefined,
    nom: data.nom,
    prenom: data.prenom || '',
    role: data.role || 'comptable',
    plan: data.plan || 'free',
    societeId: data.societeId || null,
    createdAt: new Date().toISOString().split('T')[0],
    lastLogin: null,
    actif: true,
    inviteCode: data.inviteCode || null,
  };
  const store = getRaw();
  store.users.push(user);
  save(store);
  return user;
}

export function updateUser(id, updates) {
  const store = getRaw();
  const idx = store.users.findIndex(u => u.id === id);
  if (idx === -1) return null;
  store.users[idx] = { ...store.users[idx], ...updates };
  save(store);
  return store.users[idx];
}

export function deleteUser(id) {
  return updateUser(id, { actif: false });
}

export function getSocietes() { return getRaw().societes; }

export function getSocieteById(id) { return getRaw().societes.find(s => s.id === id) || null; }

export function createSociete(data) {
  const soc = {
    id: generateId('soc'),
    nom: data.nom,
    matriculeFiscal: data.matriculeFiscal || '',
    ownerId: data.ownerId,
    membres: [data.ownerId],
    plan: data.plan || 'free',
    createdAt: new Date().toISOString().split('T')[0],
  };
  const store = getRaw();
  store.societes.push(soc);
  save(store);
  return soc;
}

export function updateSociete(id, updates) {
  const store = getRaw();
  const idx = store.societes.findIndex(s => s.id === id);
  if (idx === -1) return null;
  store.societes[idx] = { ...store.societes[idx], ...updates };
  save(store);
  return store.societes[idx];
}

export function addMembreToSociete(societeId, userId) {
  const soc = getSocieteById(societeId);
  if (!soc) return null;
  if (soc.membres.includes(userId)) return soc;
  soc.membres.push(userId);
  return updateSociete(societeId, { membres: soc.membres });
}

export function removeMembreFromSociete(societeId, userId) {
  const soc = getSocieteById(societeId);
  if (!soc) return null;
  soc.membres = soc.membres.filter(m => m !== userId);
  return updateSociete(societeId, { membres: soc.membres });
}

export function getSocieteMembres(societeId) {
  const soc = getSocieteById(societeId);
  if (!soc) return [];
  return getRaw().users.filter(u => soc.membres.includes(u.id) && u.actif);
}

export function getInvitations() { return getRaw().invitations; }

export function getInvitationByCode(code) {
  return getRaw().invitations.find(i => i.code === code && !i.used) || null;
}

export function createInvitation(data) {
  const inv = {
    code: generateInviteCode(),
    email: data.email,
    role: data.role || 'comptable',
    societeId: data.societeId,
    createdBy: data.createdBy,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    used: false,
  };
  const store = getRaw();
  store.invitations.push(inv);
  save(store);
  return inv;
}

export function useInvitation(code) {
  const store = getRaw();
  const idx = store.invitations.findIndex(i => i.code === code);
  if (idx === -1) return null;
  store.invitations[idx].used = true;
  save(store);
  return store.invitations[idx];
}

export function hasUsers() {
  return getRaw().users.filter(u => u.actif).length > 0;
}

export function getFirstUser() {
  const users = getRaw().users.filter(u => u.actif);
  return users.length > 0 ? users[0] : null;
}

export function getUserSociete(userId) {
  const user = getUserById(userId);
  if (!user || !user.societeId) return null;
  return getSocieteById(user.societeId);
}
