import { getJournalKey } from './journalKey';

function acct(e) {
  return (e.compte || '').replace(/\s.*$/, '');
}

const RATES = [19, 13, 7];

function closestRate(ratio) {
  return RATES.reduce((best, r) =>
    Math.abs(ratio - r / 100) < Math.abs(best.rel) ? { r, rel: ratio - r / 100 } : best,
    { r: 19, rel: Infinity }
  ).r;
}

export function autoFillFromJournal(periode) {
  if (!periode) return null;
  const raw = localStorage.getItem(getJournalKey());
  if (!raw) return null;
  const jb = JSON.parse(raw);
  if (!Array.isArray(jb) || !jb.length) return null;

  const entries = jb.filter(e => {
    if (!e.date) return false;
    const d = new Date(e.date);
    if (isNaN(d.getTime())) return false;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === periode;
  });
  if (!entries.length) return null;

  // Group by piece to detect TVA rates from HT+TVA pairs
  const byPiece = {};
  const standalone = [];
  for (const e of entries) {
    if (e.numeroPiece) {
      if (!byPiece[e.numeroPiece]) byPiece[e.numeroPiece] = [];
      byPiece[e.numeroPiece].push(e);
    } else {
      standalone.push(e);
    }
  }

  const caByRate = { 7: 0, 13: 0, 19: 0 };
  const tvaByRate = { 7: 0, 13: 0, 19: 0 };

  for (const pieceEntries of Object.values(byPiece)) {
    // Sales: 70XXXX credit = HT, 43671 credit = TVA
    let ht = 0, tva = 0;
    for (const e of pieceEntries) {
      const c = acct(e);
      if (c.startsWith('70') && (e.credit || 0) > 0) ht += e.credit;
      if (c.startsWith('43671') && (e.credit || 0) > 0) tva += e.credit;
    }
    if (ht > 0.001 && tva > 0.001) {
      const r = closestRate(tva / ht);
      caByRate[r] += ht;
      tvaByRate[r] += tva;
    } else if (tva > 0.001) {
      caByRate[19] += tva / 0.19;
      tvaByRate[19] += tva;
    }

    // Purchases: 6XXXX debit = HT (exclude timbre/fodec), 43666 debit = TVA
    let htAchat = 0, tvaDed = 0;
    for (const e of pieceEntries) {
      const c = acct(e);
      if (c.startsWith('6') && !c.startsWith('6654') && !c.startsWith('602') && (e.debit || 0) > 0) htAchat += e.debit;
      if (c.startsWith('43666') && (e.debit || 0) > 0) tvaDed += e.debit;
    }
  }

  // Standalone entries: fallback to simple 19%
  for (const e of standalone) {
    const c = acct(e);
    if (c.startsWith('43671') && (e.credit || 0) > 0) {
      tvaByRate[19] += e.credit;
      caByRate[19] += e.credit / 0.19;
    }
  }

  // Compute aggregates per entry
  let tvaDeductible = 0, retenueSource = 0, masseSalariale = 0, timbre = 0;
  let caLocal = 0;

  for (const e of entries) {
    const c = acct(e);
    if (c.startsWith('43666')) tvaDeductible += (e.debit || 0);
    if (c.startsWith('43674')) retenueSource += (e.credit || 0);
    if (c.startsWith('640000')) masseSalariale += (e.debit || 0);
    if (c.startsWith('6654')) timbre += (e.debit || 0);
    if (c.startsWith('70')) caLocal += (e.credit || 0) - (e.debit || 0);
  }

  const sections = {};

  // TVA section — CA by rate + deductible
  const tvaCollectee = Object.values(tvaByRate).reduce((a, b) => a + b, 0);
  if (tvaCollectee > 0.001 || tvaDeductible > 0.001) {
    sections.tva = {
      ca_19: parseFloat(caByRate[19].toFixed(3)),
      ca_13: parseFloat(caByRate[13].toFixed(3)),
      ca_7: parseFloat(caByRate[7].toFixed(3)),
      tva_deductible: parseFloat(tvaDeductible.toFixed(3)),
    };
  }

  // TFP + FOPROLOS
  if (masseSalariale > 0.001) {
    sections.tfp = {
      masse_salariale: parseFloat(masseSalariale.toFixed(3)),
      secteur_activite: '2',
    };
    sections.foprolos = {
      masse_salariale_fop: parseFloat(masseSalariale.toFixed(3)),
    };
  }

  // Timbre
  if (timbre > 0.001) {
    sections.timbre = {
      montant_timbre: parseFloat(timbre.toFixed(3)),
    };
  }

  // Retenues source (ligne 17 = achats ≥ 1000 DT TTC)
  if (retenueSource > 0.001) {
    sections.retenues_source = {
      ligne_17: parseFloat(retenueSource.toFixed(3)),
    };
  }

  // TCL — regime 3 (general) with CA local
  if (caLocal > 0.001) {
    sections.tcl = {
      regime_tcl: '3',
      ca_local_tcl: parseFloat(caLocal.toFixed(3)),
      ca_export_tcl: 0,
    };
  }

  // Taxe hôtelière — stub (auto-fill requires sector-specific data not in journal)
  // Will be populated when sector = hôtellerie/tourisme

  // Licence — stub (auto-fill requires category selection)

  // Autres taxes — stub (19 specific consumption taxes not mappable from generic accounts)

  return Object.keys(sections).length > 0 ? sections : null;
}
