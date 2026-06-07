const SESSION_KEY = 'smart_session';

export const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

export function createSession(userId, companyId) {
  const session = {
    token: crypto.randomUUID(),
    userId,
    companyId,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_DURATION_MS,
  };
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch { }
  return session;
}

export function validateSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return { valid: false };
    const session = JSON.parse(raw);
    if (Date.now() > session.expiresAt) {
      destroySession();
      return { valid: false };
    }
    return { valid: true, ...session };
  } catch {
    return { valid: false };
  }
}

export function refreshSession() {
  const { valid, userId, companyId } = validateSession();
  if (!valid) return null;
  createSession(userId, companyId);
  return { userId, companyId };
}

export function destroySession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { }
}

export function getCurrentUser() {
  const { valid, userId } = validateSession();
  if (!valid) return null;
  return userId;
}

export function getCurrentCompany() {
  const { valid, companyId } = validateSession();
  if (!valid) return null;
  return companyId;
}
