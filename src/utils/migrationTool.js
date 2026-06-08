import { supabase, isSupabaseEnabled } from './supabaseClient';
import { getJournalKey } from './journalKey';
import { getAllBulletins } from './payrollStore';

export async function migrateLocalToSupabase(companyId) {
  if (!isSupabaseEnabled()) return { journal: 0, employees: 0, invoices: 0, bulletins: 0, errors: ['Supabase non configuré'] };

  const results = { journal: 0, employees: 0, invoices: 0, bulletins: 0, errors: [] };

  const journalKey = getJournalKey();
  const entries = JSON.parse(localStorage.getItem(journalKey) || '[]');
  if (entries.length > 0) {
    const rows = entries.map(e => ({
      date: e.date,
      journal: e.journal || 'OD',
      numero_piece: e.numeroPiece || e.numero_piece,
      piece_justificative: e.piece_justificative || null,
      compte: e.compte,
      libelle: e.libelle,
      debit: e.debit || 0,
      credit: e.credit || 0,
      locked: e.locked || false,
      fournisseur: e.fournisseur || null,
      categorie: e.categorie || null,
      company_id: companyId,
      local_id: e.id || e.numeroPiece || crypto.randomUUID(),
    }));
    const { error } = await supabase.from('journal_entries').upsert(rows, { onConflict: 'local_id' });
    if (error) results.errors.push(`Journal: ${error.message}`);
    else results.journal = rows.length;
  }

  const empKey = `smart_employes_${companyId}`;
  const employes = JSON.parse(localStorage.getItem(empKey) || '[]');
  if (employes.length > 0) {
    const rows = employes.map(e => ({
      nom: e.nom, prenom: e.prenom, cin: e.cin, matricule: e.matricule,
      poste: e.poste, salaire_base: e.salaire_base,
      regime: e.regime || '40h', situation_famille: e.situation_famille || 'celibataire',
      nb_enfants: e.nb_enfants || 0, data: e.data || {},
      company_id: companyId,
    }));
    const { error } = await supabase.from('employees').insert(rows);
    if (error) results.errors.push(`Employés: ${error.message}`);
    else results.employees = rows.length;
  }

  const companiesRaw = localStorage.getItem('smart_comptable_companies');
  if (companiesRaw) {
    try {
      const companies = JSON.parse(companiesRaw);
      const companyData = companies[companyId];
      if (companyData?.invoices?.length > 0) {
        const rows = companyData.invoices.map(inv => ({
          invoice_number: inv.invoiceNumber,
          client_name: inv.clientName,
          client_email: inv.clientEmail,
          client_vat: inv.clientVat || null,
          client_address: inv.clientAddress || null,
          issue_date: inv.issueDate,
          due_date: inv.dueDate,
          subtotal: inv.subtotal || 0,
          vat_amount: inv.vatAmount || 0,
          total_amount: inv.totalAmount || 0,
          status: inv.status || 'SENT',
          items: inv.items || [],
          notes: inv.notes || null,
          company_id: companyId,
          local_id: inv.id || `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        }));
        const { error } = await supabase.from('invoices').upsert(rows, { onConflict: 'local_id' });
        if (error) results.errors.push(`Factures: ${error.message}`);
        else results.invoices = rows.length;
      }
    } catch (e) {
      results.errors.push(`Factures: ${e.message}`);
    }
  }

  const bulletins = getAllBulletins();
  if (bulletins.length > 0) {
    const rows = bulletins.map(b => ({
      employee_id: b.employeId,
      nom: b.nom, prenom: b.prenom,
      mois: b.mois, annee: b.annee,
      salaire_base: b.salaireBase || 0,
      brut: b.brut || 0,
      cnss_sal: b.cnssSal || 0,
      cnss_pat: b.cnssPat || 0,
      irpp: b.irppAnnuel ? (b.irppAnnuel / 12) : (b.rsMensuelle || 0),
      net_a_payer: b.netAPayer || 0,
      cout_employeur: b.coutEmployeur || 0,
      data: b,
      company_id: companyId,
    }));
    const { error } = await supabase.from('payroll_slips').insert(rows);
    if (error) results.errors.push(`Bulletins: ${error.message}`);
    else results.bulletins = rows.length;
  }

  if (results.errors.length === 0) {
    localStorage.setItem(`smart_migrated_${companyId}`, new Date().toISOString());
  }

  return results;
}

export function isMigrated(companyId) {
  return !!localStorage.getItem(`smart_migrated_${companyId}`);
}
