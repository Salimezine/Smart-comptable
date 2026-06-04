import { describe, it, expect } from 'vitest';
import { corrigerFacture, parseFactureTunisienne } from './src/utils/ocrParser.js';

const texte = [
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

describe('corrigerFacture E-info', () => {
  it('corrige correctement', () => {
    const parsed = parseFactureTunisienne(texte);

    let corrige;
    try {
      corrige = corrigerFacture(parsed.formulaire || {}, texte);
    } catch (e) {
      console.log('EXCEPTION:', e.message, e.stack);
      throw e;
    }
    console.log('=== corrige ===');
    console.log(JSON.stringify(corrige, null, 2));

    expect(corrige.matricule_fiscal).toBe('0012345/O/A/M/000');
    expect(corrige.sous_total_ht).toBe(273.684);
    expect(corrige.montant_tva).toBe(4.317);
    expect(corrige.total_ttc).toBe(279.000);
    expect(corrige.timbre).toBe(1.000);
  });
});
