import { supabase, isSupabaseEnabled } from './supabaseClient';
import { jsToDb } from './supabaseService';

const OFFLINE_QUEUE_KEY = 'smart_offline_queue';

function getOfflineQueue() {
  return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
}

function setOfflineQueue(q) {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(q));
}

function addToOfflineQueue(operation) {
  const q = getOfflineQueue();
  q.push({ ...operation, queued_at: new Date().toISOString() });
  setOfflineQueue(q);
}

function clearOfflineQueue() {
  localStorage.removeItem(OFFLINE_QUEUE_KEY);
}

export async function syncToCloud(table, data, operation = 'insert') {
  if (!isSupabaseEnabled()) return { success: false, reason: 'disabled' };

  try {
    let result;
    if (operation === 'insert') {
      result = await supabase.from(table).insert(jsToDb(data, table));
    } else if (operation === 'update') {
      result = await supabase.from(table).update(jsToDb(data.payload, table)).eq('id', data.id);
    } else if (operation === 'delete') {
      result = await supabase.from(table).delete().eq('id', data.id);
    } else if (operation === 'upsert') {
      result = await supabase.from(table).upsert(jsToDb(data, table));
    }
    if (result.error) throw result.error;
    return { success: true };
  } catch (err) {
    console.warn(`[Sync] ${table} ${operation} failed — queued:`, err.message);
    addToOfflineQueue({ table, data, operation });
    return { success: false, reason: err.message };
  }
}

export async function flushOfflineQueue() {
  if (!isSupabaseEnabled() || !navigator.onLine) return;
  const queue = getOfflineQueue();
  if (queue.length === 0) return;

  const failed = [];
  for (const op of queue) {
    const { success } = await syncToCloud(op.table, op.data, op.operation);
    if (!success) failed.push(op);
  }
  failed.length === 0
    ? clearOfflineQueue()
    : setOfflineQueue(failed);
}

export function initNetworkListener() {
  window.addEventListener('online', () => {
    console.log('[Sync] Connexion rétablie — flush offline queue');
    flushOfflineQueue();
  });
}

export async function fetchFromCloud(table, query = {}) {
  if (!isSupabaseEnabled() || !navigator.onLine) return null;
  try {
    let req = supabase.from(table).select('*');
    if (query.eq) Object.entries(query.eq).forEach(([k, v]) => { req = req.eq(k, v); });
    if (query.order) req = req.order(query.order, { ascending: query.asc ?? true });
    const { data, error } = await req;
    if (error) throw error;
    return data;
  } catch (err) {
    console.warn(`[Sync] fetch ${table} failed:`, err.message);
    return null;
  }
}
