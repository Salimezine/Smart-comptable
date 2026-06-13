import { describe, it, expect } from 'vitest';
import { PCG_COMPLET } from './pcgComplet';

describe('PCG_COMPLET', () => {
  it('should be an object with 657 entries', () => {
    const keys = Object.keys(PCG_COMPLET);
    expect(keys.length).toBe(657);
  });

  it('should cover all PCG classes 1-8', () => {
    const classes = new Set();
    Object.keys(PCG_COMPLET).forEach(code => {
      if (code.length >= 1) classes.add(code[0]);
    });
    expect(classes.has('1')).toBe(true);
    expect(classes.has('2')).toBe(true);
    expect(classes.has('3')).toBe(true);
    expect(classes.has('4')).toBe(true);
    expect(classes.has('5')).toBe(true);
    expect(classes.has('6')).toBe(true);
    expect(classes.has('7')).toBe(true);
    expect(classes.has('8')).toBe(true);
  });

  it('should have French labels for all entries', () => {
    Object.entries(PCG_COMPLET).forEach(([code, libelle]) => {
      expect(typeof code).toBe('string');
      expect(typeof libelle).toBe('string');
      expect(code.length).toBeGreaterThanOrEqual(2);
      expect(libelle.length).toBeGreaterThan(0);
    });
  });

  it('should include key Tunisian PCG accounts', () => {
    // Classes 1 — Capitaux propres
    expect(PCG_COMPLET['10']).toBe('Capital');
    expect(PCG_COMPLET['101']).toBe('Capital social');
    expect(PCG_COMPLET['12']).toBe('Résultats reportés');
    expect(PCG_COMPLET['13']).toBe('Résultat de l\'exercice');
    expect(PCG_COMPLET['14']).toBe('Autres capitaux propres');
    expect(PCG_COMPLET['18']).toBe('Autres passifs non courants');

    // Classes 2 — Actifs non courants
    expect(PCG_COMPLET['21']).toBe('Immobilisations incorporelles');
    expect(PCG_COMPLET['22']).toBe('Immobilisations corporelles');
    expect(PCG_COMPLET['28']).toBeDefined();

    // Classes 3 — Stocks
    expect(PCG_COMPLET['31']).toBeDefined();

    // Classes 4 — Tiers
    expect(PCG_COMPLET['40']).toBe('Fournisseurs et comptes rattachés');
    expect(PCG_COMPLET['41']).toBe('Clients et comptes rattachés');

    // Classes 5 — Financiers
    expect(PCG_COMPLET['53']).toBe('Banques, établissements financiers et assimilés');

    // Classes 6 — Charges
    expect(PCG_COMPLET['60']).toBe('Achats');
    expect(PCG_COMPLET['61']).toBe('Services extérieurs');
    expect(PCG_COMPLET['62']).toBe('Autres services extérieurs');
    expect(PCG_COMPLET['63']).toBe('Charges diverses ordinaires');
    expect(PCG_COMPLET['64']).toBe('Charges de personnel');
    expect(PCG_COMPLET['65']).toBe('Charges financières');
    expect(PCG_COMPLET['66']).toBe('Impôts, taxes et versements assimilés');
    expect(PCG_COMPLET['67']).toBe('Pertes extraordinaires');
    expect(PCG_COMPLET['68']).toBe('Dotations aux amortissements et aux provisions');

    // Classes 7 — Produits
    expect(PCG_COMPLET['70']).toBeDefined();
    expect(PCG_COMPLET['71']).toBe('Production stockée (ou déstockage)');
    expect(PCG_COMPLET['72']).toBe('Production immobilisée');
    expect(PCG_COMPLET['74']).toBe("Subventions d'exploitation et d'équilibre");
    expect(PCG_COMPLET['77']).toBe('Gains extraordinaires');
    expect(PCG_COMPLET['78']).toBe('Reprises sur amortissements et provisions');

    // Classes 8 — Comptes spéciaux
    expect(PCG_COMPLET['80']).toBe('Engagements donnés');
    expect(PCG_COMPLET['81']).toBe('Engagements reçus');
    expect(PCG_COMPLET['83']).toBe('Stocks hors exploitation');
    expect(PCG_COMPLET['84']).toBe('Comptes de fusion');
    expect(PCG_COMPLET['85']).toBe('Comptes de consolidation');
    expect(PCG_COMPLET['86']).toBe('Comptes spéciaux divers');
    expect(PCG_COMPLET['87']).toBe('Comptes de gestion spéciale');
    expect(PCG_COMPLET['88']).toBe('Résultats spéciaux');
    expect(PCG_COMPLET['89']).toBe('Comptes de bilan spéciaux');
  });

  it('should have more sub-accounts than summary accounts', () => {
    const threePlus = Object.keys(PCG_COMPLET).filter(k => k.length >= 3).length;
    const twoDigit = Object.keys(PCG_COMPLET).filter(k => k.length === 2).length;
    expect(threePlus).toBeGreaterThan(twoDigit);
  });

  it('class 6 (Charges) should be the largest class', () => {
    const class6 = Object.keys(PCG_COMPLET).filter(k => k.startsWith('6')).length;
    const class4 = Object.keys(PCG_COMPLET).filter(k => k.startsWith('4')).length;
    expect(class6).toBeGreaterThan(class4);
  });
});
