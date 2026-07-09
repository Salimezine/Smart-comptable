/**
 * Service to load structured scraped fiscal data (rates, deadlines, laws)
 * and auto-update app calculators with the latest values.
 */
const DATA_BASE = import.meta.env.BASE_URL + 'data/';

let cachedFiscalData = null;
let lastLoad = 0;
const CACHE_TTL = 60000; // 1 minute

export async function loadFiscalData(source = 'impots') {
  const now = Date.now();
  if (cachedFiscalData && now - lastLoad < CACHE_TTL) return cachedFiscalData;
  try {
    const resp = await fetch(DATA_BASE + source + '_fiscal.json');
    if (!resp.ok) return await loadFallbackFiscalData();
    const data = await resp.json();
    // If empty (scraped site blocked), fall back to default
    if (!data.taux || Object.keys(data.taux).length === 0) {
      return await loadFallbackFiscalData();
    }
    cachedFiscalData = data;
    lastLoad = now;
    return cachedFiscalData;
  } catch {
    return await loadFallbackFiscalData();
  }
}

async function loadFallbackFiscalData() {
  try {
    const resp = await fetch(DATA_BASE + '_fallback_fiscal.json');
    if (!resp.ok) return null;
    cachedFiscalData = await resp.json();
    lastLoad = Date.now();
    return cachedFiscalData;
  } catch {
    return null;
  }
}

export function getMergedFiscalData(base) {
  if (!cachedFiscalData) return base;
  const merged = { ...base };
  const taux = cachedFiscalData.taux || {};
  if (taux.tva_19) merged.tvaRate = parseFloat(taux.tva_19.taux) || 19;
  if (taux.tva_7) merged.tvaReduced7 = 7;
  if (taux.tva_13) merged.tvaReduced13 = 13;
  if (taux.is_25) merged.isRate = parseFloat(taux.is_25.taux) || 25;
  if (taux.tfp) merged.tfpRate = 1;
  if (taux.tcl) merged.tclRate = 10;
  if (cachedFiscalData.echeances && cachedFiscalData.echeances.length > 0) {
    merged.echeances = cachedFiscalData.echeances;
  }
  return merged;
}
