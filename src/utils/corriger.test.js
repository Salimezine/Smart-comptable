import { describe, it, expect } from 'vitest';
import { corrigerFacture, parseFactureTunisienne } from './ocrParser.js';

// ─── Helper ───
function run(texte, parsedSeed) {
  // parsedSeed is a flat form object (not { formulaire: ... })
  // passed directly to corrigerFacture as first arg
  if (parsedSeed !== undefined) {
    return corrigerFacture(parsedSeed, texte);
  }
  const parsed = parseFactureTunisienne(texte);
  return corrigerFacture(parsed?.formulaire || {}, texte);
}

// ─── Textes de test ───

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

// ─── Test: ÉTAPE 0 — Récapitulatif ───
describe('ÉTAPE 0 — Récapitulatif', () => {
  it('extrait tous les champs du recap', () => {
    const c = run(E_INFO_TEXTE);
    expect(c.sous_total_ht).toBe(273.684);
    expect(c.montant_tva).toBe(4.317);
    expect(c.timbre).toBe(1.000);
    expect(c.fodec).toBe(0);
    expect(c.total_ttc).toBe(279.000);
    expect(c.alertes).not.toContain('recap_manquant');
    expect(c.alertes).not.toContain('recap_manquant_ht');
    expect(c.alertes).not.toContain('recap_manquant_tva');
  });

  it('alerte recap_manquant quand tout le recap est absent', () => {
    const txt = [
      'FACTURE DIVERS',
      'Fournisseur SARL',
      'Matricule Fiscal: 0012345/0/A/M/000',
      'Date: 15/03/2025',
      'Article A  99',
      'Article B  50',
    ].join('\n');
    const c = run(txt);
    expect(c.alertes).toContain('recap_manquant');
    expect(c.alertes).not.toContain('recap_manquant_ht');
    expect(c.alertes).not.toContain('recap_manquant_tva');
  });

  it('alerte recap_manquant_ht quand seul HT manque', () => {
    const txt = [
      'FACTURE TEST',
      'Fournisseur SARL',
      'Matricule Fiscal: 0012345/O/A/M/000',
      'Total TVA: 19,000',
      'Net à payer: 119,000',
    ].join('\n');
    const c = run(txt);
    expect(c.alertes).toContain('recap_manquant_ht');
    expect(c.alertes).not.toContain('recap_manquant');
    expect(c.alertes).not.toContain('recap_manquant_tva');
  });

  it('alerte recap_manquant_tva quand seule TVA manque', () => {
    const txt = [
      'FACTURE TEST',
      'Fournisseur SARL',
      'Matricule Fiscal: 0012345/O/A/M/000',
      'Sous-total HT: 100',
      'Net à payer: 119',
    ].join('\n');
    const c = run(txt);
    expect(c.alertes).toContain('recap_manquant_tva');
    expect(c.alertes).not.toContain('recap_manquant');
    expect(c.alertes).not.toContain('recap_manquant_ht');
  });

  it('alerte ecart_recap quand TTC ≠ HT + TVA + Timbre', () => {
    const txt = [
      'FACTURE TEST',
      'E-INFO',
      'Matricule Fiscal: 0012345/O/A/M/000',
      'Souris | 7 | 7477 | 8000',
      'Sous-total HT: 100,000',
      'TVA (7%): 7,000',
      'Timbre: 1,000',
      'Net à payer: 110,000',
    ].join('\n');
    const c = run(txt);
    expect(c.alertes).toContain('ecart_recap');
  });

  it('Pas dalerte ecart_recap si TTC ≈ HT + TVA + Timbre', () => {
    const txt = [
      'FACTURE TEST',
      'E-INFO',
      'Matricule Fiscal: 0012345/O/A/M/000',
      'Sous-total HT: 100,000',
      'TVA (7%): 7,000',
      'Timbre: 1,000',
      'Net à payer: 108,000',
    ].join('\n');
    const c = run(txt);
    expect(c.alertes).not.toContain('ecart_recap');
  });

  it('fallback HT/TVA depuis lignes + TTC quand recap absent', () => {
    const txt = [
      'FACTURE TEST',
      'Fournisseur SARL',
      'Matricule Fiscal: 0012345/O/A/M/000',
      'Produit A  58962 DT  884425 DT',
    ].join('\n');
    // Seed avec TTC connu pour déclencher la dérivation
    const c = run(txt, { montant_ttc: 1000, lignes: [{ designation: 'Produit A', prix_unitaire: 884.425, quantite: 1, total: 884.425 }] });
    expect(c.sous_total_ht).toBeGreaterThan(0);
    expect(c.montant_tva).toBeGreaterThan(0);
  });
});

// ─── Test: ÉTAPE 1 — Fournisseur & MF ───
describe('ÉTAPE 1 — Fournisseur & Matricule Fiscal', () => {
  it('extrait le fournisseur depuis lentête (5 premières lignes)', () => {
    const c = run(E_INFO_TEXTE);
    expect(c.fournisseur).toBe('E-INFO');
  });

  it('extrait le MF avant le bloc client', () => {
    const c = run(E_INFO_TEXTE);
    expect(c.matricule_fiscal).toBe('0012345/O/A/M/000');
  });

  it('alerte mf_manquant si pas de MF', () => {
    const txt = [
      'FACTURE TEST',
      'Fournisseur SARL',
      'Date: 15/03/2025',
      'Sous-total HT: 100,000',
      'Net à payer: 119,000',
    ].join('\n');
    const c = run(txt);
    expect(c.alertes).toContain('mf_manquant');
  });

  it('normalise OCR 0→O dans les positions lettres du MF', () => {
    const txt = [
      'FACTURE TEST',
      'E-INFO',
      'Matricule Fiscal: 0012345/0/A/0/000',
    ].join('\n');
    const c = run(txt);
    expect(c.matricule_fiscal).toMatch(/^0012345\/O\/A\/O\/000$/);
  });
});

// ─── Test: ÉTAPE 2 — Date & Référence ───
describe('ÉTAPE 2 — Date & Référence', () => {
  it('extrait la date du champ Date:', () => {
    const txt = [
      'FACTURE TEST',
      'E-INFO',
      'Matricule Fiscal: 0012345/O/A/M/000',
      'Date: 15-03-2025',
      'Sous-total HT: 100,000',
      'TVA: 7,000',
      'Net à payer: 108,000',
    ].join('\n');
    const c = run(txt);
    expect(c.date).toBe('15/03/2025');
  });

  it('alerte date_manquante si pas de date', () => {
    const c = run(E_INFO_TEXTE);
    expect(c.alertes).toContain('date_manquante');
  });

  it('extrait le numéro de facture', () => {
    const txt = [
      'FACTURE FA20BJ001',
      'E-INFO',
      'Matricule Fiscal: 0012345/O/A/M/000',
      'Date: 15-03-2025',
      'Sous-total HT: 100,000',
      'Net à payer: 119,000',
    ].join('\n');
    const c = run(txt);
    expect(c.numero_justificatif).toBeTruthy();
  });
});

// ─── Test: ÉTAPE 3 — TVA Mixte ───
describe('ÉTAPE 3 — TVA Mixte', () => {
  it('détecte Mixte quand 0% + autre taux', () => {
    const c = run(E_INFO_TEXTE);
    expect(c.taux_tva).toBe('Mixte');
    expect(c.alertes).toContain('tva_mixte_verifier');
  });

  it('taux unique quand un seul taux présent', () => {
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
    const c = run(txt);
    expect(c.taux_tva).toBe('19%');
  });

  it('taux depuis FOURNISSEURS_LOOKUP si aucun taux dans lignes', () => {
    const txt = [
      'FACTURE TEST',
      'STEG',
      'Matricule Fiscal: 0012345/O/A/M/000',
      'Sous-total HT: 100,000',
      'Net à payer: 114,000',
    ].join('\n');
    const c = run(txt);
    // STEG a tva:13 dans lookup
    expect(c.taux_tva).toBe('13%');
  });
});

// ─── Test: ÉTAPE 4 — Catégorie ───
describe('ÉTAPE 4 — Catégorie', () => {
  it('détecte Matériel informatique depuis les articles', () => {
    const c = run(E_INFO_TEXTE);
    expect(c.categorie).toBe('Matériel informatique');
  });

  it('détecte Télécoms & Internet depuis les articles', () => {
    const txt = [
      'FACTURE TEST',
      'OOREDOO TUNISIE',
      'Matricule Fiscal: 0012345/O/A/M/000',
      'Abonnement 4G  58,962 DT  884,425 DT',
      'Sous-total HT: 884,425',
      'TVA: 114,975',
      'Timbre: 0,600',
      'Net à payer: 1 000,000',
    ].join('\n');
    const c = run(txt);
    expect(c.categorie).toBe('Télécoms & Internet');
  });

  it('détecte Services & Honoraires', () => {
    const txt = [
      'FACTURE TEST',
      'RAPID PRESS',
      'Matricule Fiscal: 0012345/O/A/M/000',
      'Prestation maintenance  1 000,000 DT  1 000,000 DT',
      'Sous-total HT: 1 000,000',
      'TVA: 70,000',
      'Net à payer: 1 071,000',
    ].join('\n');
    const c = run(txt);
    expect(c.categorie).toBe('Services & Honoraires');
  });

  it('détecte Charges & Services pour loyer/électricité', () => {
    const txt = [
      'FACTURE TEST',
      'Fournisseur SARL',
      'Matricule Fiscal: 0012345/O/A/M/000',
      'Loyer local  1 500,000 DT  1 500,000 DT',
      'Sous-total HT: 1 500,000',
      'TVA: 0,000',
      'Net à payer: 1 501,000',
    ].join('\n');
    const c = run(txt);
    expect(c.categorie).toBe('Charges & Services');
  });

  it('détecte Fournitures & Consommables', () => {
    const txt = [
      'FACTURE TEST',
      'MONOPRIX',
      'Matricule Fiscal: 0012345/O/A/M/000',
      'Papier A4  30,000 DT  30,000 DT',
      'Stylos  15,000 DT  15,000 DT',
      'Sous-total HT: 45,000',
      'TVA: 8,550',
      'Net à payer: 54,550',
    ].join('\n');
    const c = run(txt);
    expect(c.categorie).toBe('Fournitures & Consommables');
  });

  it('alerte categorie_inconnue si non reconnu', () => {
    const txt = [
      'FACTURE TEST',
      'Fournisseur SARL',
      'Matricule Fiscal: 0012345/O/A/M/000',
      'Pièces détachées  500,000 DT  500,000 DT',
      'Sous-total HT: 500,000',
      'TVA: 95,000',
      'Net à payer: 596,000',
    ].join('\n');
    const c = run(txt);
    expect(c.alertes).toContain('categorie_inconnue');
  });

  it('articles mixtes → catégorie du plus haut HT', () => {
    // Même texte que E_INFO (abonnement + souris) mais avec "Abonnement" ajouté
    const txt = [
      "FACTURE D'ACHAT",
      'E-INFO',
      'Matricule Fiscal: 0012345/O/A/M/000',
      'Client:',
      '1234567/X/A/M/000',
      "FACTURÉ À",
      'SARL CLIENT',
      'Adresse Client',
      '',
      "Désignation | TVA | PrixHT | TotalTTC",
      'ABONNEMENT 4G | 19 | 500000 | 595000',
      'SOURIS | 19 | 10000 | 11900',
      '',
      'Sous-total HT: 510,000',
      'TVA: 96,900',
      'Net à payer: 607,900',
    ].join('\n');
    const c = run(txt);
    // "Télécoms & Internet" a 500 HT > "Matériel informatique" a 10 HT
    expect(c.categorie).toBe('Télécoms & Internet');
  });
});

// ─── Test: ÉTAPE 5 — Timbre & FODEC ───
describe('ÉTAPE 5 — Timbre & FODEC', () => {
  it('utilise le timbre imprimé sur la facture', () => {
    const c = run(E_INFO_TEXTE);
    expect(c.timbre).toBe(1.000);
  });

  it('timbre par défaut à 1 DT si non imprimé', () => {
    const txt = [
      'FACTURE TEST',
      'Fournisseur SARL',
      'Matricule Fiscal: 0012345/O/A/M/000',
      'Sous-total HT: 100,000',
      'TVA: 19,000',
      'Net à payer: 120,000',
    ].join('\n');
    const c = run(txt);
    expect(c.timbre).toBe(1.000);
  });

  it('timbre 0 pour STEG/SONEDE', () => {
    const txt = [
      'FACTURE TEST',
      'STEG',
      'Matricule Fiscal: 0012345/O/A/M/000',
      'Sous-total HT: 50,000',
      'TVA: 6,500',
      'Net à payer: 56,500',
    ].join('\n');
    const c = run(txt);
    expect(c.timbre).toBe(0.000);
  });

  it('FODEC depuis la facture', () => {
    const txt = [
      'FACTURE TEST',
      'Fournisseur SARL',
      'Matricule Fiscal: 0012345/O/A/M/000',
      'Sous-total HT: 100,000',
      'TVA: 19,000',
      'FODEC: 1,000',
      'Timbre: 1,000',
      'Net à payer: 121,000',
    ].join('\n');
    const c = run(txt);
    expect(c.fodec).toBe(1.000);
  });

  it('FODEC par défaut 0 si non imprimé', () => {
    const c = run(E_INFO_TEXTE);
    expect(c.fodec).toBe(0);
  });
});

// ─── Test: ÉTAPE 6 — Alertes ───
describe('ÉTAPE 6 — Alertes', () => {
  it('alerte retenue_source_probable si TTC > 5000', () => {
    const txt = [
      'FACTURE TEST',
      'Fournisseur SARL',
      'Matricule Fiscal: 0012345/O/A/M/000',
      'Sous-total HT: 5000,000',
      'TVA: 950,000',
      'Timbre: 1,000',
      'Net à payer: 5951,000',
    ].join('\n');
    const c = run(txt);
    expect(c.alertes).toContain('retenue_source_probable');
  });

  it('alerte date_future si date dans le futur', () => {
    const txt = [
      'FACTURE TEST',
      'Fournisseur SARL',
      'Matricule Fiscal: 0012345/O/A/M/000',
      'Date: 15-06-2030',
      'Sous-total HT: 100,000',
      'TVA: 7,000',
      'Timbre: 1,000',
      'Net à payer: 108,000',
    ].join('\n');
    const c = run(txt);
    expect(c.alertes).toContain('date_future');
  });

  it('alerte ecart_lignes_recap si HT lignes ≠ recap HT', () => {
    // E_INFO_TEXTE a des lignes avec des valeurs en millièmes
    // mais le recap dit 273,684
    const c = run(E_INFO_TEXTE);
    // Les lignes parsées donnent des montants différents du recap
    // Donc ecart_lignes_recap devrait être présent
    expect(c.alertes).toContain('ecart_lignes_recap');
  });

  it('alerte ecart_tva si TVA recalculée ≠ recap TVA', () => {
    // E_INFO_TEXTE a tva_mixte et des écarts possibles
    const c = run(E_INFO_TEXTE);
    expect(c.alertes).toContain('ecart_tva');
  });

  it('alerte retenue_source quand prestation détectée', () => {
    const txt = [
      'FACTURE TEST',
      'RAPID PRESS',
      'Matricule Fiscal: 0012345/O/A/M/000',
      'Sous-total HT: 100,000',
      'TVA: 7,000',
      'Timbre: 1,000',
      'Net à payer: 108,000',
      'Prestation maintenance',
    ].join('\n');
    const c = run(txt);
    // Rapid press a RS: true dans le lookup
    expect(c.retenue_source).toBe(true);
  });
});

// ─── Test: Seed values depuis parsed ───
describe('Seed values depuis parsed', () => {
  it('mappe 10+ variants de noms de champs', () => {
    const form = {
      fournisseur_nom: 'E-INFO SEED',
      fournisseur_mf: '0012345/O/B/N/111',
      date_facture: '01/01/2025',
      numero_justificatif: 'FACT-999',
      categorie_principale: 'Services & Honoraires',
      taux_tva: '7',
      montant_ht: 500,
      montant_tva: 35,
      timbre_fiscal: 2,
      fodec: 0.5,
      montant_ttc: 537.5,
    };
    // Texte < 10 chars pour déclencher early exit et garder les seed values
    const c = run('Texte', form);
    expect(c.fournisseur).toBe('E-INFO SEED');
    expect(c.matricule_fiscal).toBe('0012345/O/B/N/111');
    expect(c.date).toBe('01/01/2025');
    expect(c.numero_justificatif).toBe('FACT-999');
    expect(c.categorie).toBe('Services & Honoraires');
    expect(c.taux_tva).toBe('7%');
    expect(c.sous_total_ht).toBe(500);
    expect(c.montant_tva).toBe(35);
    expect(c.timbre).toBe(2);
    expect(c.fodec).toBe(0.5);
    expect(c.total_ttc).toBe(537.5);
  });

  it('texte_trop_court si moins de 10 caractères', () => {
    const c = run('court');
    expect(c.alertes).toContain('texte_trop_court');
  });
});

// ─── Test: Intégration avec parseFactureTunisienne ───
describe('Correction complète E-info', () => {
  it('corrige correctement tous les champs', () => {
    const parsed = parseFactureTunisienne(E_INFO_TEXTE);
    const corrige = corrigerFacture(parsed.formulaire || {}, E_INFO_TEXTE);

    expect(corrige.matricule_fiscal).toBe('0012345/O/A/M/000');
    expect(corrige.sous_total_ht).toBe(273.684);
    expect(corrige.montant_tva).toBe(4.317);
    expect(corrige.total_ttc).toBe(279.000);
    expect(corrige.timbre).toBe(1.000);
    expect(corrige.fournisseur).toBe('E-INFO');
    expect(corrige.categorie).toBe('Matériel informatique');
    expect(corrige.taux_tva).toBe('Mixte');
    expect(corrige.alertes).toContain('tva_mixte_verifier');
    expect(corrige.lignes.length).toBeGreaterThan(1);
  });
});

describe('Correction complète Aradenet', () => {
  it('corrige correctement l\'invoce Aradenet', () => {
    const txt = [
      "Adresse Rue du Lac Malaren, Lotissement El Khalij Les Berges du Lac",
      "Facture N° 50",
      "Date 03/04/2015",
      "Référence Unique 86812500069016077795819135",
      "Copie de la facture électronique enregistré chez TTN",
      "CENT CINQUANTE DEUX DINARS ET DEUX CENT SOIXANTE MILLIMES-"
    ].join('\n');

    const parsed = parseFactureTunisienne(txt);
    const corrige = corrigerFacture(parsed.formulaire || {}, txt);

    expect(corrige.fournisseur).toBe('TTN');
    expect(corrige.date).toBe('03/04/2015');
    expect(corrige.total_ttc).toBe(152.260);
    expect(corrige.sous_total_ht).toBeCloseTo(127.109, 2);
    expect(corrige.montant_tva).toBeCloseTo(24.151, 2);
    expect(corrige.timbre).toBe(1.000);
  });
});

describe('Correction complète My Company', () => {
  it('corrige correctement l\'invoice My Company avec date format US et calculs dérivés', () => {
    const txt = [
      "My Company",
      "Date Mar 23 2010",
      "Matricule Fiscal: 9999999/A/B/C/000",
      "Service maintenance informatique",
      "Net à payer : 80,000 DT"
    ].join('\n');

    const parsed = parseFactureTunisienne(txt);
    const corrige = corrigerFacture(parsed.formulaire || {}, txt);

    expect(corrige.fournisseur).toBe('My Company');
    expect(corrige.date).toBe('23/03/2010');
    expect(corrige.matricule_fiscal).toBe('9999999/A/B/C/000');
    expect(corrige.total_ttc).toBe(80.000);
    expect(corrige.sous_total_ht).toBeCloseTo(66.387, 2);
    expect(corrige.montant_tva).toBeCloseTo(12.613, 2);
    expect(corrige.timbre).toBe(1.000);
  });
});

