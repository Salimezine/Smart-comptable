const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

function getSalt(companyId) {
  const base = 'smart_comptable_salt_v1';
  return new TextEncoder().encode(`${base}_${companyId || 'default'}`);
}

export async function deriveKey(pin, companyId) {
  const salt = getSalt(companyId);
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptData(plaintext, key) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(JSON.stringify(plaintext));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptData(encrypted, key) {
  try {
    const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
    const iv = combined.slice(0, IV_LENGTH);
    const ciphertext = combined.slice(IV_LENGTH);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch { return null; }
}

const SENSITIVE_PREFIXES = [
  'smart_journal_', 'smart_employes_', 'smart_bulletins_',
  'smart_invoices_', 'smart_expenses_', 'smart_users',
  'smart_companies', 'smart_audit_'
];

export function isSensitiveKey(key) {
  return SENSITIVE_PREFIXES.some(p => key === p || key.startsWith(p));
}

export function isConfigKey(key) {
  return key.startsWith('smart_security') || key === 'smart_app_locked' ||
    key.startsWith('smart_failed') || key === 'smart_ui_prefs';
}

export async function setSecure(key, value, cryptoKey) {
  if (!isSensitiveKey(key)) {
    localStorage.setItem(key, JSON.stringify(value));
    return;
  }
  const encrypted = await encryptData(value, cryptoKey);
  localStorage.setItem(key, encrypted);
}

export async function getSecure(key, cryptoKey) {
  if (!isSensitiveKey(key)) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  const encrypted = localStorage.getItem(key);
  if (!encrypted) return null;
  return decryptData(encrypted, cryptoKey);
}

export function removeSecure(key) {
  localStorage.removeItem(key);
}
