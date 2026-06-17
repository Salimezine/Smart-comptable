import { supabase, isSupabaseEnabled } from './supabaseClient';

export async function loadDeclarations(companyId) {
  if (!isSupabaseEnabled()) return [];
  const { data, error } = await supabase
    .from('declarations_is')
    .select('*')
    .eq('company_id', companyId)
    .order('exercice', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveDeclaration(companyId, decl) {
  if (!isSupabaseEnabled()) throw new Error('Supabase non connecté');
  const { data, error } = await supabase
    .from('declarations_is')
    .upsert({
      company_id: companyId,
      exercice: decl.exercice,
      regime: decl.regime || 'normal',
      resultat_fiscal: decl.resultatFiscal || 0,
      taux_is: decl.taux || 0.25,
      impot_brut: decl.impotBrut || 0,
      css: decl.css || 0,
      impot_css: decl.impotCSS || 0,
      acompte1: decl.acompte1 || 0,
      acompte2: decl.acompte2 || 0,
      acompte3: decl.acompte3 || 0,
      total_acomptes: decl.totalAcomptes || 0,
      solde: decl.solde || 0,
      statut: 'soumise',
      date_echeance: decl.dateEcheance || `${decl.exercice + 1}-03-31`,
      date_soumission: new Date().toISOString(),
      notes: decl.notes || '',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateDeclarationStatus(id, statut, datePaiement) {
  if (!isSupabaseEnabled()) return;
  const updates = { statut };
  if (datePaiement) updates.date_paiement = datePaiement;
  await supabase.from('declarations_is').update(updates).eq('id', id);
}

export const IS_STATUS_BADGES = {
  brouillon: { label: 'Brouillon', color: 'text-slate-400 bg-slate-800' },
  soumise: { label: 'Soumise', color: 'text-blue-400 bg-blue-500/10' },
  payee: { label: 'Payée', color: 'text-emerald-400 bg-emerald-500/10' },
  en_retard: { label: 'En retard', color: 'text-red-400 bg-red-500/10' },
};
