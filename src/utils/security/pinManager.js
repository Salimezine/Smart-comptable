export const PIN_CONFIG = {
  timeout_ms: 10 * 60 * 1000,
  max_attempts: 5,
  lockout_duration_ms: 15 * 60 * 1000,
};

export async function hashPIN(pin) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPIN(pin, storedHash) {
  const h = await hashPIN(pin);
  return h === storedHash;
}

export function startInactivityTimer(onLock) {
  const cfg = getConfig();
  stopInactivityTimer();
  window.__inactivityTimer = setTimeout(() => {
    lockApp();
    if (onLock) onLock();
  }, cfg.timeout_ms || PIN_CONFIG.timeout_ms);
}

export function stopInactivityTimer() {
  if (window.__inactivityTimer) {
    clearTimeout(window.__inactivityTimer);
    window.__inactivityTimer = null;
  }
}

export function resetInactivityTimer(onLock) {
  startInactivityTimer(onLock);
}

export function lockApp() {
  localStorage.setItem('smart_app_locked', 'true');
  stopInactivityTimer();
}

export function unlockApp() {
  localStorage.removeItem('smart_app_locked');
}

export function isLocked() {
  return localStorage.getItem('smart_app_locked') === 'true';
}

export function getFailedAttempts() {
  const raw = localStorage.getItem('smart_failed_attempts');
  return raw ? parseInt(raw) || 0 : 0;
}

export function recordFailedAttempt() {
  const n = getFailedAttempts() + 1;
  localStorage.setItem('smart_failed_attempts', String(n));
  if (n >= PIN_CONFIG.max_attempts) {
    localStorage.setItem('smart_lockout_until', String(Date.now() + PIN_CONFIG.lockout_duration_ms));
  }
  return n;
}

export function clearFailedAttempts() {
  localStorage.removeItem('smart_failed_attempts');
  localStorage.removeItem('smart_lockout_until');
}

export function getLockoutRemaining() {
  const until = parseInt(localStorage.getItem('smart_lockout_until')) || 0;
  return Math.max(0, until - Date.now());
}

export function isLockedOut() {
  return getLockoutRemaining() > 0;
}

export function getConfig() {
  try {
    const raw = localStorage.getItem('smart_security_config');
    if (raw) {
      const c = JSON.parse(raw);
      return { ...PIN_CONFIG, ...c };
    }
  } catch { }
  return { ...PIN_CONFIG };
}

export function setConfig(partial) {
  const current = getConfig();
  const updated = { ...current, ...partial };
  localStorage.setItem('smart_security_config', JSON.stringify(updated));
}
