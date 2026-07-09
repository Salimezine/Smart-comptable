import { supabase, isSupabaseEnabled } from './supabaseClient';

let kbCache = null;
let listeners = [];
let channel = null;

function notifyListeners() {
  for (const fn of listeners) fn(kbCache);
}

export function onKnowledgeChange(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter(l => l !== fn); };
}

async function refetch() {
  if (!isSupabaseEnabled()) return null;
  try {
    const { data, error } = await supabase
      .from('fiscal_knowledge')
      .select('*')
      .eq('active', true)
      .order('priority', { ascending: false });
    if (error) throw error;
    kbCache = (data || []).map(entry => ({
      id: entry.id,
      keywords: entry.keywords || [],
      tags: entry.tags || [],
      answerFR: entry.answer_fr || '',
      answerAR: entry.answer_ar || '',
    }));
    notifyListeners();
    return kbCache;
  } catch (err) {
    console.warn('[TaxKnowledge] fetch error:', err.message);
    return null;
  }
}

export async function loadKnowledgeBase() {
  if (!isSupabaseEnabled()) return null;

  const result = await refetch();

  if (!channel) {
    channel = supabase
      .channel('fiscal_knowledge_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'fiscal_knowledge' },
        () => { refetch(); }
      )
      .subscribe();
  }

  return result;
}

export function getCachedKnowledge() {
  return kbCache;
}

export async function syncKnowledgeNow() {
  kbCache = null;
  return loadKnowledgeBase();
}
