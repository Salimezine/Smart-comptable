import { supabase, isSupabaseEnabled } from './supabaseClient';
import { setUserTemplates } from './formulaEngine';

let templateCache = null;
let listeners = [];
let channel = null;

function notifyListeners() {
  for (const fn of listeners) fn(templateCache);
}

export function onTemplateChange(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter(l => l !== fn); };
}

async function refetch() {
  if (!isSupabaseEnabled()) return null;
  try {
    const { data, error } = await supabase
      .from('declaration_templates')
      .select('*')
      .eq('active', true)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true });
    if (error) throw error;
    templateCache = (data || []).map(entry => ({
      id: entry.id?.toString() || entry.name,
      name: entry.name,
      client_match: entry.client_match || '',
      is_default: !!entry.is_default,
      sector: entry.sector || '',
      regime: entry.regime || '',
      is_user: true,
      config: entry.config || {},
    }));
    setUserTemplates(templateCache);
    notifyListeners();
    return templateCache;
  } catch (err) {
    console.warn('[TemplateService] fetch error:', err.message);
    return null;
  }
}

export async function loadTemplates() {
  if (!isSupabaseEnabled()) return null;
  const result = await refetch();
  if (!channel) {
    channel = supabase
      .channel('declaration_templates_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'declaration_templates' },
        () => { refetch(); }
      )
      .subscribe();
  }
  return result;
}

export function getCachedTemplates() {
  return templateCache;
}

export async function saveTemplate(template) {
  if (!isSupabaseEnabled()) return null;
  try {
    const { data, error } = await supabase
      .from('declaration_templates')
      .insert({
        name: template.name,
        client_match: template.client_match || '',
        is_default: false,
        sector: template.sector || '',
        regime: template.regime || '',
        active: true,
        config: template.config || {},
      })
      .select()
      .single();
    if (error) throw error;
    await refetch();
    return data;
  } catch (err) {
    console.warn('[TemplateService] save error:', err.message);
    return null;
  }
}

export async function deleteTemplate(id) {
  if (!isSupabaseEnabled()) return;
  try {
    const { error } = await supabase
      .from('declaration_templates')
      .update({ active: false })
      .eq('id', id);
    if (error) throw error;
    await refetch();
  } catch (err) {
    console.warn('[TemplateService] delete error:', err.message);
  }
}

export async function updateTemplate(id, updates) {
  if (!isSupabaseEnabled()) return null;
  try {
    const { data, error } = await supabase
      .from('declaration_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await refetch();
    return data;
  } catch (err) {
    console.warn('[TemplateService] update error:', err.message);
    return null;
  }
}

export async function syncTemplatesNow() {
  templateCache = null;
  return loadTemplates();
}
