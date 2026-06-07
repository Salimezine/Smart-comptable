import { hashPIN, verifyPIN } from '../security/pinManager';
import { logAction, AUDIT_ACTIONS } from '../security/auditLog';

const USERS_KEY = 'smart_users';

function getStorage() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function setStorage(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export const ROLES = ['admin', 'comptable', 'readonly'];

export function createUser(data) {
  const users = getStorage();
  if (users.find(u => u.email === data.email && u.active)) return null;
  const user = {
    id: crypto.randomUUID(),
    nom: data.nom || '',
    prenom: data.prenom || '',
    email: data.email || '',
    role: data.role || 'comptable',
    pin_hash: data.pin || '',
    companies: data.companies || [],
    permissions: data.permissions || {},
    created_at: new Date().toISOString(),
    last_login: null,
    active: true,
  };
  users.push(user);
  setStorage(users);
  logAction(AUDIT_ACTIONS.USER_CREATE, { userId: user.id, nom: user.nom, role: user.role });
  return user;
}

export function updateUser(id, data) {
  const users = getStorage();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return null;
  const updated = { ...users[idx], ...data };
  if (data.pin) updated.pin_hash = data.pin;
  users[idx] = updated;
  setStorage(users);
  logAction(AUDIT_ACTIONS.USER_EDIT, { userId: id });
  return updated;
}

export function deleteUser(id) {
  const users = getStorage();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return false;
  users[idx].active = false;
  setStorage(users);
  logAction(AUDIT_ACTIONS.USER_DELETE, { userId: id });
  return true;
}

export function getUsers() {
  return getStorage().filter(u => u.active);
}

export function getAllUsers() {
  return getStorage();
}

export function getUserById(id) {
  return getStorage().find(u => u.id === id) || null;
}

export async function authenticateUser(pin) {
  const users = getStorage().filter(u => u.active);
  for (const user of users) {
    if (user.pin_hash && await verifyPIN(pin, user.pin_hash)) {
      user.last_login = new Date().toISOString();
      updateUser(user.id, { last_login: user.last_login });
      logAction(AUDIT_ACTIONS.LOGIN, { userId: user.id, nom: `${user.prenom} ${user.nom}` });
      return user;
    }
  }
  return null;
}

export function getFirstUser() {
  const users = getStorage().filter(u => u.active);
  return users.length > 0 ? users[0] : null;
}

export function hasUsers() {
  return getStorage().filter(u => u.active).length > 0;
}
