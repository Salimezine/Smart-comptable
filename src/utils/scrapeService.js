/**
 * Service for loading scraped fiscal data from public/data/.
 * Run `npm run scrape` (Python crawl4ai) to refresh the data.
 */
const DATA_BASE = import.meta.env.BASE_URL + 'data/';

export async function loadScrapedIndex() {
  try {
    const resp = await fetch(DATA_BASE + 'scrape_index.json');
    if (!resp.ok) return null;
    return await resp.json();
  } catch { return null; }
}

export async function loadScrapedMarkdown(source) {
  try {
    const resp = await fetch(DATA_BASE + source + '.md');
    if (!resp.ok) return null;
    return await resp.text();
  } catch { return null; }
}

export async function loadScrapedMeta(source) {
  try {
    const resp = await fetch(DATA_BASE + source + '_meta.json');
    if (!resp.ok) return null;
    return await resp.json();
  } catch { return null; }
}

export async function loadCompetitorFeatures(source) {
  try {
    const resp = await fetch(DATA_BASE + source + '_features.json');
    if (!resp.ok) return null;
    return await resp.json();
  } catch { return null; }
}
