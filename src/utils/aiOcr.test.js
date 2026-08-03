import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mergeAI } from './aiOcr';

describe('mergeAI — remise', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    });
  });

  it('prend la remise de l\'IA et son HT net', () => {
    const current = { fournisseur_nom: 'STE X', montant_ht: 1000, montant_ttc: 1172, lignes: [] };
    const ai = { montant_ht: 900, remise: 100, remise_pourcent: 10, montant_tva: 171, montant_ttc: 1072 };
    const out = mergeAI(current, ai);
    expect(out.remise).toBe(100);
    expect(out.remise_pourcent).toBe(10);
    expect(out.montant_ht).toBe(900);
  });

  it('conserve la remise du parser si l\'IA n\'en renvoie pas', () => {
    const current = { montant_ht: 900, remise: 100, remise_pourcent: 10, lignes: [] };
    const ai = { montant_ht: 900, remise: 0, montant_ttc: 1072 };
    const out = mergeAI(current, ai);
    expect(out.remise).toBe(100);
    expect(out.remise_pourcent).toBe(10);
  });

  it('ne met pas de remise quand l\'IA n\'en détecte pas', () => {
    const current = { montant_ht: 1000, lignes: [] };
    const ai = { montant_ht: 1000, remise: 0, remise_pourcent: 0 };
    const out = mergeAI(current, ai);
    expect(out.remise).toBeUndefined();
  });
});
