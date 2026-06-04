import { describe, it, expect, beforeAll } from 'vitest';
import { corrigerFacture, parseFactureTunisienne } from './utils/ocrParser.js';
import { journalComptable, saveJournalPiece } from './utils/journalComptable.js';
import { generateFromJournal } from './accountingUtils.js';

function newStore() {
  const s = {};
  global.localStorage = {
    getItem: (k) => s[k] ?? null,
    setItem: (k, v) => { s[k] = String(v); },
    removeItem: (k) => { delete s[k]; },
    clear: () => { Object.keys(s).forEach(k => delete s[k]); },
  };
  global.window = { dispatchEvent: () => {} };
  return s;
}
let store;
beforeAll(() => { store = newStore(); });

const E_INFO_TEXTE = [
  "FACTURE D'ACHAT",
  'E-INFO',
  'Matricule Fiscal: 0012345/O/A/M/000',
  '',
  'Client:',
  '1234567/X/A/M/000',
  "FACTURÉ À",
  'SARL CLIENT',
  'Adresse Client',
  '',
  "Désignation | TVA | PrixHT | TotalTTC",
  'SOURIS RAMITECH | 7 | 7477 | 8000',
  'SOURIS SANS FILS | 7 | 14019 | 15000',
  'CHARGEUR | 0 | 200000 | 200000',
  'CARTES MEMOIRES | 7 | 19627 | 21000',
  'BOITIER 2.5 | 7 | 20561 | 22000',
  'Impression | 0 | 12000 | 12000',
  '',
  'Sous-total HT: 273,684',
  'TVA (7%): 4,317',
  'Timbre: 1,000',
  'Net à payer: 279,000',
  '',
  'Arrêtée la présente facture à la somme de Deux cent soixante dix-neuf Dinars'
].join('\n');

describe('SCE Integration: OCR → Journal → États Financiers', () => {
  it('génère bilan et résultat depuis une facture E-info', () => {
    store = newStore();

    const parsed = parseFactureTunisienne(E_INFO_TEXTE);
    const corrige = corrigerFacture(parsed.formulaire || {}, E_INFO_TEXTE);

    expect(corrige.matricule_fiscal).toBe('0012345/O/A/M/000');
    expect(corrige.sous_total_ht).toBe(273.684);
    expect(corrige.montant_tva).toBe(4.317);
    expect(corrige.total_ttc).toBe(279.000);
    expect(corrige.timbre).toBe(1.000);

    const piece = journalComptable(corrige, { type: 'achat', fournisseurNom: 'E-INFO' });
    expect(piece.validated).toBe(true);
    expect(saveJournalPiece(piece)).toBe(true);

    const sce = generateFromJournal();
    expect(sce).not.toBeNull();

    expect(sce.bilan.fournisseurs).toBeCloseTo(0.279, 3);
    expect(sce.bilan.etatDebit).toBeCloseTo(0.004, 2);
    expect(sce.resultat.achats).toBeCloseTo(0.274, 2);
    expect(sce.resultat.impotsTaxes).toBeCloseTo(0.001, 2);
  });

  it('accumule deux factures dans le bilan', () => {
    store = newStore();

    for (let i = 0; i < 2; i++) {
      const parsed = parseFactureTunisienne(E_INFO_TEXTE);
      const corrige = corrigerFacture(parsed.formulaire || {}, E_INFO_TEXTE);
      corrige.numero_justificatif = `FACT-${i + 1}`;
      saveJournalPiece(journalComptable(corrige, { type: 'achat', fournisseurNom: 'E-INFO' }));
    }

    const sce = generateFromJournal();
    expect(sce.bilan.fournisseurs).toBeCloseTo(0.558, 3);
    expect(sce.resultat.achats).toBeCloseTo(0.547, 2);
  });
});
