import { describe, it, expect } from 'vitest';
import {
  calculateTotalRevenues,
  calculatePendingRevenues,
  calculateTotalExpenses,
  calculateBankBalance,
  calculateEstimatedTaxes,
  calculateInvoiceTotals,
  formatCurrencyHelper
} from './accountingUtils';

describe('Tests Unitaires - Moteur Comptable & Fiscal (Penni AI)', () => {
  
  // 1. Calculs des revenus encaissés (PAID)
  describe('calculateTotalRevenues', () => {
    it('devrait retourner 0 si la liste est vide', () => {
      expect(calculateTotalRevenues([])).toBe(0);
    });

    it('devrait sommer uniquement les factures au statut PAID', () => {
      const mockInvoices = [
        { id: '1', totalAmount: 5000.00, status: 'PAID' },
        { id: '2', totalAmount: 3000.00, status: 'SENT' },
        { id: '3', totalAmount: 1200.00, status: 'PAID' },
        { id: '4', totalAmount: 800.00, status: 'OVERDUE' }
      ];
      expect(calculateTotalRevenues(mockInvoices)).toBe(6200.00);
    });

    it('devrait gérer les valeurs invalides ou malformées', () => {
      const mockInvoices = [
        { id: '1', totalAmount: "5000", status: 'PAID' },
        { id: '2', totalAmount: null, status: 'PAID' },
        { id: '3', status: 'PAID' }
      ];
      expect(calculateTotalRevenues(mockInvoices)).toBe(5000.00);
    });
  });

  // 2. Calculs des revenus en attente (SENT)
  describe('calculatePendingRevenues', () => {
    it('devrait retourner 0 si la liste est vide', () => {
      expect(calculatePendingRevenues([])).toBe(0);
    });

    it('devrait sommer uniquement les factures au statut SENT', () => {
      const mockInvoices = [
        { id: '1', totalAmount: 5000.00, status: 'PAID' },
        { id: '2', totalAmount: 3000.00, status: 'SENT' },
        { id: '3', totalAmount: 1500.00, status: 'SENT' }
      ];
      expect(calculatePendingRevenues(mockInvoices)).toBe(4500.00);
    });
  });

  // 3. Calculs des dépenses totales
  describe('calculateTotalExpenses', () => {
    it('devrait sommer correctement toutes les dépenses enregistrées', () => {
      const mockExpenses = [
        { id: '1', totalAmount: 150.00 },
        { id: '2', totalAmount: 55.50 },
        { id: '3', totalAmount: 1240.00 }
      ];
      expect(calculateTotalExpenses(mockExpenses)).toBe(1445.50);
    });
  });

  // 4. Calcul du solde bancaire réconcilié
  describe('calculateBankBalance', () => {
    it('devrait additionner et soustraire correctement les écritures bancaires', () => {
      const mockTransactions = [
        { amount: 5000.00 },  // Virement reçu (+5000)
        { amount: -150.00 },  // Prélèvement (-150)
        { amount: -1200.00 }, // Achat matériel (-1200)
        { amount: 450.00 }    // Remboursement (+450)
      ];
      // Solde de départ par défaut = 32800
      expect(calculateBankBalance(32800, mockTransactions)).toBe(36900.00);
    });
  });

  // 5. Estimation des taxes & IS Tunisie (15%)
  describe('calculateEstimatedTaxes', () => {
    it('devrait estimer correctement l\'IS tunisien à 15%', () => {
      expect(calculateEstimatedTaxes(10000)).toBe(1500);
    });

    it('devrait retourner 0 pour un revenu nul ou négatif', () => {
      expect(calculateEstimatedTaxes(0)).toBe(0);
      expect(calculateEstimatedTaxes(-500)).toBe(0);
    });
  });

  // 6. Calcul des lignes d'articles avec Timbre Fiscal tunisien (1.000 DT)
  describe('calculateInvoiceTotals', () => {
    it('devrait retourner le Timbre Fiscal seul si aucun article n\'est présent', () => {
      expect(calculateInvoiceTotals([])).toEqual({
        subtotal: 0,
        vatAmount: 0,
        stampDuty: 1.000,
        totalAmount: 1.000
      });
    });

    it('devrait calculer correctement HT, TVA 19%, Timbre 1.000 DT et TTC', () => {
      const mockItems = [
        { quantity: 2, unitPrice: 150.000, vatRate: 19 }, // HT = 300, TVA = 57
        { quantity: 1, unitPrice: 45.000, vatRate: 13 }   // HT = 45, TVA = 5.850
      ];
      expect(calculateInvoiceTotals(mockItems)).toEqual({
        subtotal: 345.000,
        vatAmount: 62.850,
        stampDuty: 1.000,
        totalAmount: 408.850
      });
    });

    it('devrait arrondir les montants à 3 décimales (standard Dinar Tunisien)', () => {
      const mockItems = [
        { quantity: 1, unitPrice: 10.333, vatRate: 19 }
        // HT = 10.333, TVA = 1.963 (10.333 * 0.19 = 1.96327 → arrondi = 1.963)
      ];
      const result = calculateInvoiceTotals(mockItems);
      expect(result.subtotal).toBe(10.333);
      expect(result.vatAmount).toBe(1.963);
      expect(result.stampDuty).toBe(1.000);
      expect(result.totalAmount).toBe(13.296);
    });
  });

  // 7. Formateur de devises
  describe('formatCurrencyHelper', () => {
    it('devrait retourner une chaîne formatée avec le symbole Euro', () => {
      const formatted = formatCurrencyHelper(1250.50, 'EUR');
      expect(formatted).toContain('1');
      expect(formatted).toContain('250');
      // Le symbole de devise ou son code devrait y figurer
      expect(formatted).toMatch(/(€|EUR)/);
    });
  });
});
