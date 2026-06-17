import { supabase, isSupabaseEnabled } from './supabaseClient';

export async function loadDeclarations(companyId, type) {
  if (!isSupabaseEnabled()) return [];
  const q = supabase
    .from('declarations_sociales')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  if (type) q.eq('type', type);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function saveDeclaration(companyId, decl) {
  if (!isSupabaseEnabled()) throw new Error('Supabase non connecté');
  const { data, error } = await supabase
    .from('declarations_sociales')
    .upsert({
      company_id: companyId,
      type: decl.type,
      periode: decl.periode,
      statut: 'soumise',
      nb_employes: decl.nbEmployes || 0,
      total_brut: decl.totalBrut || 0,
      total_salaire_imposable: decl.totalImposable || 0,
      cnss_salarie: decl.cnssSal || 0,
      cnss_patronal: decl.cnssPat || 0,
      cnss_total: decl.cnssTotal || 0,
      irpp_annuel: decl.irpp || 0,
      rs_mensuelle: decl.rs || 0,
      css: decl.css || 0,
      net_a_payer: decl.netAPayer || 0,
      date_echeance: decl.dueDate,
      date_soumission: new Date().toISOString(),
      bulletins: decl.bulletins || null,
      reference: decl.reference || '',
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
  await supabase.from('declarations_sociales').update(updates).eq('id', id);
}

export function generateIRPPFromPayroll(bulletins) {
  const totalBrut = bulletins.reduce((s, b) => s + (b.brut || 0), 0);
  const totalCNSS = bulletins.reduce((s, b) => s + (b.cnssSal || 0), 0);
  const totalRS = bulletins.reduce((s, b) => s + (b.rsMensuelle || 0), 0);
  const totalCSS = bulletins.reduce((s, b) => s + (b.cssAnnuelle || 0), 0);
  const totalNet = bulletins.reduce((s, b) => s + (b.netAPayer || 0), 0);

  return {
    totalBrut,
    totalCNSS,
    totalRS,
    totalCSS,
    totalNet,
    nbEmployes: bulletins.length,
  };
}

export function generateCNSSFromBulletins(bulletins) {
  const cnssSal = bulletins.reduce((s, b) => s + (b.cnssSal || 0), 0);
  const cnssPat = bulletins.reduce((s, b) => s + (b.cnssPat || 0), 0);
  const totalBrut = bulletins.reduce((s, b) => s + (b.brut || 0), 0);
  const totalNet = bulletins.reduce((s, b) => s + (b.netAPayer || 0), 0);

  return {
    cnssSal,
    cnssPat,
    cnssTotal: cnssSal + cnssPat,
    totalBrut,
    totalNet,
    nbEmployes: bulletins.length,
  };
}

const STATUS_BADGES = {
  brouillon: { label: 'Brouillon', color: 'text-slate-400 bg-slate-800' },
  soumise: { label: 'Soumise', color: 'text-blue-400 bg-blue-500/10' },
  payee: { label: 'Payée', color: 'text-emerald-400 bg-emerald-500/10' },
  en_retard: { label: 'En retard', color: 'text-red-400 bg-red-500/10' },
};
