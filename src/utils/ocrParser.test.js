import { describe, it, expect } from 'vitest';
import {
  correctOCRText,
  detectFournisseur,
  detectMF,
  detectNumeroFacture,
  detectTotalHT,
  detectTotalTTC,
  detectTauxTVA,
  detectMontantTVA,
  detectTimbre,
  detectFODEC,
  detectRetenueSource,
  detectRSPrestation,
  detectModeReglement,
  detectCategoriesSecondaires,
  verifierCoherence,
  genererAlertes,
  corrigerOCRAvecTrace,
  normaliserMontant,
  detectDate,
  detectRemise,
  corrigerFacture,
  parseFactureTunisienne,
  generateInvoiceNumber,
} from './ocrParser';

describe('correctOCRText', () => {
  it('retourne chaîne vide pour input non-string', () => {
    expect(correctOCRText(null)).toBe('');
    expect(correctOCRText(undefined)).toBe('');
    expect(correctOCRText(123)).toBe('');
  });

  it('nettoie les retours chariot et espaces insécables', () => {
    const result = correctOCRText('ligne1\r\nligne2\u00A0test');
    expect(result).toContain('\n');
    expect(result).not.toContain('\r\n');
    expect(result).not.toContain('\u00A0');
  });
});

describe('detectFournisseur', () => {
  it('détecte un fournisseur connu', () => {
    const text = `STE BONJOUR
Avenue Habib Bourguiba
Tunis`;
    expect(detectFournisseur(text)).toBe('STE BONJOUR');
  });

  it('retourne null pour texte sans fournisseur', () => {
    expect(detectFournisseur('facture diverse')).toBeNull();
  });
});

describe('detectMF', () => {
  it('détecte MF avec préfixe MF', () => {
    const result = detectMF('MF: 1234567X/A/M/000');
    expect(result).toBeTruthy();
    expect(result).toContain('1234567');
  });

  it('retourne null si aucun MF', () => {
    expect(detectMF('pas de matricule ici')).toBeNull();
  });
});

describe('detectNumeroFacture', () => {
  it('détecte numéro avec référence complète', () => {
    expect(detectNumeroFacture('Facture N° 2024-001')).toBe('2024-001');
  });
});

describe('detectDate', () => {
  it('détecte date au format JJ/MM/AAAA et retourne ISO', () => {
    const text = `Facture N° 001
Date: 15/03/2024
Total TTC: 500.000`;
    expect(detectDate(text)).toBe('2024-03-15');
  });

  it('retourne null si aucune date', () => {
    expect(detectDate('pas de date ici')).toBeNull();
  });
});

describe('Total HT / TTC / TVA', () => {
  it('detectTotalHT trouve le montant HT', () => {
    const text = `Total HT: 1 200.000
TVA 19%: 228.000
Timbre: 1.000`;
    expect(detectTotalHT(text)).toBe(1200);
  });

  it('detectTotalTTC trouve le montant TTC', () => {
    const text = `Net à payer: 1 429.000
TVA 19%: 228.000`;
    expect(detectTotalTTC(text)).toBe(1429);
  });

  it('detectMontantTVA trouve le montant TVA', () => {
    const text = `TVA 19%: 228.000
Total TTC: 1 429.000`;
    expect(detectMontantTVA(text)).toBe(228);
  });
});

describe('detectTauxTVA', () => {
  it('détecte taux 19%', () => {
    expect(detectTauxTVA('TVA 19%')).toBe(19);
  });

  it('détecte taux 13%', () => {
    expect(detectTauxTVA('TVA 13%')).toBe(13);
  });
});

describe('Timbre / FODEC / RS', () => {
  it('detectTimbre trouve timbre fiscal', () => {
    expect(detectTimbre('Timbre fiscal 1.000')).toBe(1);
  });

  it('detectFODEC trouve FODEC', () => {
    expect(detectFODEC('FODEC: 5.000')).toBeCloseTo(5);
  });

  it('detectRetenueSource trouve RS', () => {
    expect(detectRetenueSource('Retenue à la source: 45.000')).toBeCloseTo(45);
  });
});

describe('detectRSPrestation', () => {
  it('détecte RS pour prestation informatique', () => {
    const info = detectRSPrestation('Facture pour maintenance serveur STE BONJOUR');
    expect(info.applicable).toBe(true);
  });

  it('pas de RS pour achat marchandise', () => {
    const info = detectRSPrestation('Achat de fournitures de bureau');
    expect(info.applicable).toBe(false);
  });
});

describe('detectModeReglement', () => {
  it('détecte chèque', () => {
    expect(detectModeReglement('Règlement par Chèque N° 1234')).toBe('chèque');
  });

  it('détecte virement', () => {
    expect(detectModeReglement('par Virement bancaire')).toBe('virement');
  });
});

describe('verifierCoherence', () => {
  it('valide une facture cohérente HT + TVA = TTC', () => {
    const data = {
      montant_ht: 1000,
      montant_tva: 190,
      montant_ttc: 1190,
      timbre_fiscal: 1,
      fodec: 0,
      rs: 0,
    };
    expect(verifierCoherence(data).calculs_coherents).toBe(true);
  });

  it('invalide si HT + TVA ≠ TTC', () => {
    const data = {
      montant_ht: 1000,
      montant_tva: 190,
      montant_ttc: 1500,
      timbre_fiscal: 0,
      fodec: 0,
      rs: 0,
    };
    expect(verifierCoherence(data).calculs_coherents).toBe(false);
  });
});

describe('normaliserMontant', () => {
  it('convertit "1 200.000" en 1200', () => {
    expect(normaliserMontant('1 200.000')).toBe(1200);
  });

  it('convertit "500,000" en 500', () => {
    expect(normaliserMontant('500,000')).toBe(500);
  });
});

describe('genererAlertes', () => {
  it('retourne un tableau', () => {
    const alerts = genererAlertes({ montant_ht: 1000, montant_ttc: 1190, timbre_fiscal: 1 });
    expect(Array.isArray(alerts)).toBe(true);
  });
});

describe('corrigerOCRAvecTrace', () => {
  it('retourne un objet { text, corrections }', () => {
    const result = corrigerOCRAvecTrace('Test texte');
    expect(typeof result).toBe('object');
    expect(typeof result.text).toBe('string');
    expect(Array.isArray(result.corrections)).toBe(true);
  });
});

describe('detectCategoriesSecondaires', () => {
  it('retourne un tableau vide pour texte sans catégories', () => {
    const cats = detectCategoriesSecondaires('facture simple');
    expect(Array.isArray(cats)).toBe(true);
  });
});

describe('generateInvoiceNumber', () => {
  it('génère un numéro avec préfixe FACT-année', () => {
    const year = new Date().getFullYear();
    const result = generateInvoiceNumber([]);
    expect(result).toContain(`FACT-${year}`);
  });
});

describe('parseFactureTunisienne (nouveau format)', () => {
  it('retourne le nouveau format { formulaire, verification, confiance_ocr, champs_a_confirmer }', () => {
    // Le texte doit contenir ≥30 caractères pour ne pas retourner null
    const result = parseFactureTunisienne('STE BONJOUR\nFacture test de démonstration\nTimbre: 1.000\n');
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('formulaire');
    expect(result).toHaveProperty('verification');
    expect(result).toHaveProperty('confiance_ocr');
    expect(result).toHaveProperty('champs_a_confirmer');
    expect(result.formulaire).toHaveProperty('taux_tva_details');
    expect(result.formulaire).toHaveProperty('rs_base');
    expect(result.verification).toHaveProperty('source_valeurs');
  });

  it('extrait correctement une facture simple 19%', () => {
    const text = `STE BONJOUR
MF: 1234567X/A/M/000
Facture N° 2024-001
Date: 15/03/2024
Total HT: 1 000.000
TVA 19%: 190.000
Timbre fiscal: 1.000
Total TTC: 1 191.000
`;
    const result = parseFactureTunisienne(text);
    expect(result).not.toBeNull();
    expect(result.formulaire.fournisseur_nom).toBe('STE BONJOUR');
    expect(result.formulaire.fournisseur_mf).toBeTruthy();
    expect(result.formulaire.fournisseur_mf).toContain('1234567');
    expect(result.formulaire.date_facture).toBeTruthy();
    expect(result.formulaire.numero_justificatif).toBeTruthy();
    expect(result.formulaire.montant_ht).toBeCloseTo(1000);
    expect(result.formulaire.montant_tva).toBeCloseTo(190);
    expect(result.formulaire.montant_ttc).toBeCloseTo(1191);
    expect(result.formulaire.taux_tva).toBe(19);
  });

  it('source_valeurs = "recap_imprime" quand pas de lignes mais totaux présents', () => {
    const text = `STE BONJOUR
Total HT: 1 000.000
TVA 19%: 190.000
Total TTC: 1 191.000
`;
    const result = parseFactureTunisienne(text);
    expect(result).not.toBeNull();
    expect(result.verification.source_valeurs).toBe('recap_imprime');
  });

  it('gère FODEC', () => {
    const text = `STE BONJOUR
Total HT: 500.000
TVA 19%: 95.000
FODEC: 5.000
Timbre: 1.000
Total TTC: 601.000
`;
    const result = parseFactureTunisienne(text);
    expect(result).not.toBeNull();
    expect(result.formulaire.fodec).toBeCloseTo(5);
  });

  it('retourne null pour texte < 30 caractères', () => {
    expect(parseFactureTunisienne('abc')).toBeNull();
  });
});

describe('detectRemise', () => {
  it('détecte une remise en pourcentage', () => {
    const text = `STE BONJOUR
Total HT: 1 000.000
Remise 10%
TVA 19%: 171.000
Timbre fiscal: 1.000
Total TTC: 1 172.000
`;
    expect(detectRemise(text)).toEqual({ pourcent: 10 });
  });

  it('détecte une remise en montant DT', () => {
    const text = `Total HT: 1 000.000
Remise : 50.000 DT
Total TTC: 1 132.000
`;
    const r = detectRemise(text);
    expect(r.montant).toBeCloseTo(50, 3);
  });

  it('retourne null sans remise', () => {
    expect(detectRemise('Total HT: 100.000\nTVA: 19.000\n')).toBeNull();
  });

  it('retourne null pour entrée non-string', () => {
    expect(detectRemise(null)).toBeNull();
    expect(detectRemise(undefined)).toBeNull();
  });

  it('détecte une remise avec points de remplissage OCR', () => {
    const r = detectRemise('Remise .............. 100.000');
    expect(r.montant).toBeCloseTo(100, 3);
  });

  it('détecte une remise accentuée Rémise', () => {
    expect(detectRemise('Rémise 10%')).toEqual({ pourcent: 10 });
  });

  it('détecte une remise en arabe خصم', () => {
    expect(detectRemise('خصم 10%')).toEqual({ pourcent: 10 });
    const r = detectRemise('خصم : 100.000');
    expect(r.montant).toBeCloseTo(100, 3);
  });

  it('préfère le pourcentage sur "Remise X% = montant"', () => {
    expect(detectRemise('Remise 10% = 100.000')).toEqual({ pourcent: 10 });
  });
});

describe('corrigerFacture — remise', () => {
  it('soustrait une remise en pourcentage du sous-total HT', () => {
    const text = `STE BONJOUR
MF: 1234567X/A/M/000
Facture N° 2024-001
Date: 15/03/2024
Total HT: 1 000.000
Remise 10%
TVA 19%: 171.000
Timbre fiscal: 1.000
Total TTC: 1 072.000
`;
    const result = corrigerFacture({}, text);
    expect(result.remise).toBeCloseTo(100, 3);
    expect(result.remise_pourcent).toBe(10);
    expect(result.sous_total_ht).toBeCloseTo(900, 3);
  });
});
