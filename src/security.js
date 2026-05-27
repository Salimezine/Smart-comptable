const STORAGE_KEYS = {
  pinHash: 'sc_pin_hash',
  pinSalt: 'sc_pin_salt',
  encryptedApiKey: 'sc_enc_api_key',
  encryptedCompany: 'sc_enc_company',
  encryptedInvoices: 'sc_enc_invoices',
};

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

let inactivityTimer = null;
let onLockCallback = null;

const encode = (s) => new TextEncoder().encode(s);
const decode = (b) => new TextDecoder().decode(b);
const bufToHex = (b) => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');

const deriveKey = async (pin, salt) => {
  const keyMaterial = await crypto.subtle.importKey('raw', encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

export const hashPin = async (pin) => {
  const hash = await crypto.subtle.digest('SHA-256', encode(pin));
  return bufToHex(hash);
};

export const isPinSet = () => !!localStorage.getItem(STORAGE_KEYS.pinHash);

export const setPin = async (pin) => {
  const hash = await hashPin(pin);
  localStorage.setItem(STORAGE_KEYS.pinHash, hash);
};

export const verifyPin = async (pin) => {
  const stored = localStorage.getItem(STORAGE_KEYS.pinHash);
  if (!stored) return true;
  return (await hashPin(pin)) === stored;
};

export const encryptData = async (plaintext, pin) => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encode(plaintext));
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);
  return btoa(String.fromCharCode(...combined));
};

export const decryptData = async (ciphertext, pin) => {
  try {
    const combined = new Uint8Array(atob(ciphertext).split('').map(c => c.charCodeAt(0)));
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const data = combined.slice(28);
    const key = await deriveKey(pin, salt);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return decode(decrypted);
  } catch {
    return null;
  }
};

export const storeEncrypted = async (key, data, pin) => {
  if (!pin) return;
  const encrypted = await encryptData(JSON.stringify(data), pin);
  localStorage.setItem(key, encrypted);
};

export const getDecrypted = async (key, pin) => {
  const encrypted = localStorage.getItem(key);
  if (!encrypted) return null;
  const decrypted = await decryptData(encrypted, pin);
  if (!decrypted) return null;
  return JSON.parse(decrypted);
};

export const STORAGE = STORAGE_KEYS;

export const resetAll = () => {
  Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
};

export const onInactivity = (callback) => {
  onLockCallback = callback;
};

const resetInactivityTimer = () => {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    if (onLockCallback) onLockCallback();
  }, INACTIVITY_TIMEOUT_MS);
};

export const setupInactivityTracker = () => {
  const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
  const handler = () => resetInactivityTimer();
  events.forEach(e => document.addEventListener(e, handler));
  resetInactivityTimer();
  return () => events.forEach(e => document.removeEventListener(e, handler));
};
