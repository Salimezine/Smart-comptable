import { describe, it, expect } from 'vitest';
import { corrigerFacture, parseFactureTunisienne } from './ocrParser.js';
import { correctOCRText, corrigerOCRAvecTrace, FOURNISSEURS_LOOKUP } from './ocrParser.js';

describe('Debug test 4 v2', () => {
  it('taux unique debug', async () => {
    const txt = [
      'FACTURE TEST',
      'E-INFO',
      'Matricule Fiscal: 0012345/O/A/M/000',
      'Souris | 19 | 7477 | 8000',
      'Clavier | 19 | 14019 | 15000',
      'Sous-total HT: 21,496',
      'TVA: 4,084',
      'Net à payer: 26,580',
    ].join('\n');

    // Step 1: correctOCRText
    const corrected = correctOCRText(txt);
    console.log('corrected:', JSON.stringify(corrected));
    
    // Step 2: corrigerOCRAvecTrace
    const { text, corrections } = corrigerOCRAvecTrace(txt);
    console.log('traced text:', JSON.stringify(text));
    console.log('corrections:', corrections);
    
    // Step 3: detectLignes
    const { detectLignes } = await import('./ocrParser.js');
    const lignes = detectLignes(text);
    console.log('lignes:', JSON.stringify(lignes));
    
    // Step 4: detectFournisseur
    const { detectFournisseur } = await import('./ocrParser.js');
    const four = detectFournisseur(text);
    console.log('fournisseur:', four);
    console.log('lookup:', FOURNISSEURS_LOOKUP[four?.toLowerCase()]);
    
    // Step 5: compare taux detection
    const { detectTauxTVA } = await import('./ocrParser.js');
    const tauxFromRaw = detectTauxTVA(txt);
    const tauxFromCorr = detectTauxTVA(text);
    console.log('taux from raw:', tauxFromRaw);
    console.log('taux from corrected:', tauxFromCorr);
  });
});
