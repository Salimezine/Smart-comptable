function getCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function trackUsage(userId, action) {
  const key = `sc_usage_${userId}_${getCurrentMonth()}`;
  try {
    const raw = localStorage.getItem(key);
    const usage = raw ? JSON.parse(raw) : {};
    usage[action] = (usage[action] || 0) + 1;
    localStorage.setItem(key, JSON.stringify(usage));
  } catch { }
}

export function getUsageThisMonth(userId, action) {
  const key = `sc_usage_${userId}_${getCurrentMonth()}`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return 0;
    const usage = JSON.parse(raw);
    return usage[action] || 0;
  } catch { return 0; }
}

export function getAllUsageThisMonth(userId) {
  const key = `sc_usage_${userId}_${getCurrentMonth()}`;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
