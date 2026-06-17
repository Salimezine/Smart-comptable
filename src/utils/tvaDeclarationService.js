import { supabase, isSupabaseEnabled } from './supabaseClient';
import { getJournalKey } from './journalKey';

const TVA_COLLECTEE_PREFIX = '43671';
const TVA_DEDUCTIBLE_PREFIX = '43666';

export function computeTVAFromJournal() {
  const jb = JSON.parse(localStorage.getItem(getJournalKey()) || '[]');
  const monthly = {};

  jb.forEach(entry => {
    const d = new Date(entry.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthly[key]) monthly[key] = { collected: 0, deductible: 0, baseHT: 0, baseDeductible: 0, entries: 0 };

    const compte = (entry.compte || '').replace(/\s.*$/, '');
    if (compte.startsWith(TVA_COLLECTEE_PREFIX)) {
      monthly[key].collected += (entry.credit || 0);
      monthly[key].baseHT += (entry.debit || 0);
    }
    if (compte.startsWith(TVA_DEDUCTIBLE_PREFIX)) {
      monthly[key].deductible += (entry.debit || 0);
      monthly[key].baseDeductible += (entry.credit || 0);
    }
    monthly[key].entries++;
  });

  return Object.entries(monthly).sort(([a], [b]) => a.localeCompare(b)).map(([month, m]) => {
    const d = new Date(`${month}-01`);
    const echeance = new Date(d.getFullYear(), d.getMonth() + 1, 20);
    return {
      month,
      label: d.toLocaleString('fr-FR', { month: 'long', year: 'numeric' }),
      collected: m.collected,
      deductible: m.deductible,
      due: Math.max(0, m.collected - m.deductible),
      credit: Math.max(0, m.deductible - m.collected),
      baseHT: m.baseHT,
      baseDeductible: m.baseDeductible,
      dueDate: echeance.toISOString().split('T')[0],
      entries: m.entries,
    };
  });
}

export async function loadDeclarations(companyId) {
  if (!isSupabaseEnabled()) return [];
  const { data, error } = await supabase
    .from('tva_declarations')
    .select('*')
    .eq('company_id', companyId)
    .order('periode', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveDeclaration(companyId, declaration) {
  if (!isSupabaseEnabled()) throw new Error('Supabase non connecté');
  const { data, error } = await supabase
    .from('tva_declarations')
    .upsert({
      company_id: companyId,
      periode: declaration.periode,
      type_declaration: declaration.type || 'mensuelle',
      base_ht: declaration.baseHT || 0,
      tva_collectee: declaration.collected || 0,
      tva_deductible: declaration.deductible || 0,
      tva_due: declaration.due || 0,
      credit_tva: declaration.credit || 0,
      penalites: declaration.penalites || 0,
      net_a_payer: declaration.netAPayer || declaration.due || 0,
      statut: 'soumise',
      date_echeance: declaration.dueDate,
      date_soumission: new Date().toISOString(),
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
  await supabase.from('tva_declarations').update(updates).eq('id', id);
}

export function generateDeclarationPDF(declaration, company) {
  const lines = [
    `DÉCLARATION TVA - ${declaration.label}`,
    `Société: ${company.name || ''}`,
    `Matricule fiscal: ${company.matricule_fiscal || ''}`,
    `Adresse: ${company.adresse || ''}`,
    `Période: ${declaration.periode || declaration.month}`,
    `Date d'échéance: ${declaration.dueDate || ''}`,
    '',
    'Récapitulatif:',
    `Base HT: ${(declaration.baseHT || 0).toFixed(3)} DT`,
    `TVA Collectée: ${(declaration.collected || 0).toFixed(3)} DT`,
    `TVA Déductible: ${(declaration.deductible || 0).toFixed(3)} DT`,
    `TVA Due: ${(declaration.due || 0).toFixed(3)} DT`,
    declaration.credit > 0 ? `Crédit de TVA: ${(declaration.credit || 0).toFixed(3)} DT` : '',
    '',
    'Généré par Smart Comptable',
    new Date().toLocaleString('fr-FR'),
  ].filter(Boolean).join('\n');

  const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `declaration_tva_${declaration.periode || declaration.month}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
