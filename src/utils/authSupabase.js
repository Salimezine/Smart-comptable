// ==========================================================================
//  authSupabase → cloudClient (Cloudflare Workers + D1)
// ==========================================================================
import {
  isSupabaseEnabled,
  signUp as signUpCloud,
  signIn as signInCloud,
  signOut as signOutCloud,
  getSession as getSessionCloud,
  getCurrentUser as getCurrentUserCloud,
  onAuthChange as onAuthChangeCloud,
} from './cloudClient';

export async function signUp(email, password) {
  return signUpCloud(email, password);
}

export async function signIn(email, password) {
  return signInCloud(email, password);
}

export async function signOut() {
  await signOutCloud();
}

export async function getSession() {
  return getSessionCloud();
}

export async function getCurrentUser() {
  return getCurrentUserCloud();
}

export function onAuthChange(callback) {
  return onAuthChangeCloud(callback);
}
