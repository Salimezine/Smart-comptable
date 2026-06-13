import { calculateIRPP } from './smartIRPP.js';
import { calculateIS } from './smartIS.js';

const TAX_KNOWLEDGE_BASE = {
  tva: {
    taux: [
      { taux: 19, label: 'TVA normale', applicable: 'Biens et services généraux' },
      { taux: 13, label: 'TVA réduite 1', applicable: 'Transport, tourisme, produits agricoles transformés' },
      { taux: 7, label: 'TVA réduite 2', applicable: 'Produits de base, électricité, eau, produits pharmaceutiques' },
      { taux: 0, label: 'TVA zéro', applicable: 'Exportations, transports internationaux' },
    ],
    declarations: [
      { periode: 'Mensuel', echeance: '20 du mois suivant', applicable: 'Assujettis au régime mensuel' },
      { periode: 'Trimestriel', echeance: '20 du mois suivant le trimestre', applicable: 'Assujettis au régime trimestriel (CA < 100 000 DT)' },
    ],
    deductions: [
      'TVA déductible sur achats courants (avec factures conformes)',
      'TVA déductible sur immobilisations',
      'TVA déductible sur importations',
      'TVA sur carburant (limitée à 70%)',
    ],
    penalites: [
      'Retard de déclaration : 5% du montant dû par mois de retard',
      'Défaut de déclaration : 25% du montant dû',
      'Amende pour non-facturation : 100 DT à 1000 DT par facture',
    ],
  },
  irpp: {
    bareme: [
      { tranche: '0 – 5 000 DT', taux: 0, montant_max: 5000, taux_cumul: 0, cumul_max: 0 },
      { tranche: '5 001 – 20 000 DT', taux: 26, montant_max: 20000, taux_cumul: 26, cumul_max: 3900 },
      { tranche: '20 001 – 30 000 DT', taux: 28, montant_max: 30000, taux_cumul: 27.33, cumul_max: 6700 },
      { tranche: '30 001 – 50 000 DT', taux: 32, montant_max: 50000, taux_cumul: 29.22, cumul_max: 13100 },
      { tranche: 'Au-delà de 50 000 DT', taux: 35, montant_max: Infinity, taux_cumul: null, cumul_max: null },
    ],
    deductions_communiques: [
      'Frais d\'assurance-vie (plafond 1 500 DT)',
      'Intérêts sur crédit immobilier (plafond 3 000 DT)',
      'Dons aux œuvres sociales (plafond 1 000 DT)',
      'Dividendes déjà soumis à la retenue à la source',
    ],
    seuil_imposition: 5000,
  },
  is: {
    taux_normal: 15,
    taux_etablissements_stables: 25,
    taux_banques: 35,
    taux_societes_civiles: 35,
    provisions: [
      'Provision pour créances douteuses (dans limite fiscale)',
      'Provision pour risques et charges (justifiée)',
      'Amortissements comptables déductibles',
    ],
    declaraton: {
      echeance: '31 mars de l\'année suivante (ou 30 avril si en ligne)',
      acomptes: 'Trois acomptes provisionnels : 30%, 30%, 40%',
    },
  },
  cnss: {
    taux: {
      employeur: 16.57,
      salarie: 9.18,
      total: 25.75,
    },
    plafond: { mensuel: 6000, annuel: 72000 },
    declarations: [
      { type: 'Déclaration mensuelle', echeance: 'Fin du mois suivant' },
      { type: 'État 301 (CNSS)', echeance: '31 janvier N+1' },
    ],
  },
  fiscalite_entreprises: [
    {
      regime: 'Régime réel',
      conditions: 'CA annuel > 500 000 DT (ventes) ou > 200 000 DT (prestations)',
      obligations: ['Comptabilité complète', 'Déclaration mensuelle TVA', 'Bilan annuel', 'Liasse fiscale'],
    },
    {
      regime: 'Régime simplifié',
      conditions: 'CA annuel 100 000 – 500 000 DT',
      obligations: ['Comptabilité simplifiée', 'Déclaration trimestrielle TVA', 'Bilan annuel'],
    },
    {
      regime: 'Régime forfaitaire',
      conditions: 'CA annuel < 100 000 DT',
      obligations: ['Déclaration annuelle unique', 'Tenue de livre de recettes'],
    },
  ],
};

const FISCAL_RISK_INDICATORS = [
  { id: 'tva_mismatch', label: 'Écart TVA collectée / déclarée', severity: 'high' },
  { id: 'missing_declarations', label: 'Absence de déclarations périodiques', severity: 'high' },
  { id: 'profit_anomaly', label: 'Anomalie de rentabilité vs secteur', severity: 'medium' },
  { id: 'expense_ratio', label: 'Ratio frais / CA anormal', severity: 'medium' },
  { id: 'payroll_irpp', label: 'Écart paie / IRPP retenu', severity: 'high' },
  { id: 'cnss_late', label: 'Retard de déclaration CNSS', severity: 'medium' },
  { id: 'teif_missing', label: 'Factures sans transmission TEIF', severity: 'low' },
  { id: 'rs_non_reverse', label: 'Retenue à la source non reversée', severity: 'high' },
];

export function generateResponse(query, context = {}) {
  const q = query.toLowerCase();
  const { invoices = [], expenses = [], history = [] } = context;
  // Conversation memory: tag the query type for follow-up context
  const lastType = history.length > 0 ? history[history.length - 1].type : null;

  // --- Calcul IRPP personnalisé ---
  if ((q.includes('calcule') || q.includes('mon irpp') || q.includes('est mon irpp')) && (q.includes('irpp') || q.includes('revenu'))) {
    const revenuMatch = q.match(/(\d[\d\s]*)\s*dt/i);
    let revenu = 0;
    if (revenuMatch) revenu = parseFloat(revenuMatch[1].replace(/\s/g, ''));
    if (!revenu && invoices.length > 0) revenu = invoices.reduce((s, i) => s + (i.totalAmount || 0), 0);

    if (revenu > 0) {
      const result = calculateIRPP(revenu);
      return {
        type: 'irpp_calculated',
        message: `**Calcul IRPP personnalisé**\n\nRevenu imposable : **${revenu.toLocaleString('fr-TN')} DT**\n\n${result.tranches.filter(t => t.applicable).map(t => `• Tranche ${t.min.toLocaleString('fr-TN')} - ${t.max === Infinity ? '∞' : t.max.toLocaleString('fr-TN')} DT (${t.taux}%) : ${t.impotPartiel.toLocaleString('fr-TN')} DT`).join('\n')}\n\n**Total IRPP : ${result.impotBrut.toLocaleString('fr-TN')} DT**\n**Taux effectif : ${result.tauxEffectif.toFixed(1)}%**\n\n💡 Simulation disponible dans la section IRPP.`,
        data: { revenu, ...result },
      };
    }
  }

  // --- Calcul IS personnalisé ---
  if ((q.includes('calcule') || q.includes('mon is') || q.includes('est mon is')) && (q.includes('is') || q.includes('impôt société'))) {
    const resultatMatch = q.match(/(\d[\d\s]*)\s*dt/i);
    let resultat = 0;
    if (resultatMatch) resultat = parseFloat(resultatMatch[1].replace(/\s/g, ''));
    if (!resultat && invoices.length > 0 && expenses.length > 0) {
      resultat = invoices.reduce((s, i) => s + (i.totalAmount || 0), 0) - expenses.reduce((s, e) => s + (e.totalAmount || 0), 0);
    }
    if (resultat > 0) {
      const result = calculateIS(resultat);
      return {
        type: 'is_calculated',
        message: `**Calcul IS personnalisé**\n\nRésultat fiscal estimé : **${resultat.toLocaleString('fr-TN')} DT**\nTaux : **${(result.taux * 100).toFixed(0)}%**\n**IS brut : ${result.impotBrut.toLocaleString('fr-TN')} DT**\n\n**Acomptes :**\n${result.acomptes.map(a => `• ${a.numero}e acompte (${(a.taux * 100).toFixed(0)}%) : ${a.montant.toLocaleString('fr-TN')} DT — échéance ${a.echeance}`).join('\n')}\n\n**Total acomptes : ${result.totalAcomptes.toLocaleString('fr-TN')} DT**\n**Solde à payer : ${result.soldeAPayer.toLocaleString('fr-TN')} DT**`,
        data: { resultat, ...result },
      };
    }
  }

  if (q.includes('tva') || q.includes('taux tva')) {
    const taux = TAX_KNOWLEDGE_BASE.tva.taux;
    return {
      type: 'tva_rates',
      message: `**Taux de TVA en Tunisie (LF 2025)**\n\n${taux.map(t => `• **${t.taux}%** — ${t.label}\n  ${t.applicable}`).join('\n\n')}\n\nLes assujettis doivent déclarer la TVA mensuellement ou trimestriellement selon leur chiffre d'affaires.`,
      data: taux,
    };
  }

  if (q.includes('declaration') && q.includes('tva')) {
    return {
      type: 'tva_declaration',
      message: `**Déclarations de TVA**\n\n${TAX_KNOWLEDGE_BASE.tva.declarations.map(d => `• **${d.periode}** — Échéance : ${d.echeance}\n  ${d.applicable}`).join('\n\n')}\n\n**TVA déductible :**\n${TAX_KNOWLEDGE_BASE.tva.deductions.map(d => `• ${d}`).join('\n')}`,
      data: TAX_KNOWLEDGE_BASE.tva.declarations,
    };
  }

  if (q.includes('irpp') || q.includes('impôt sur le revenu')) {
    const bareme = TAX_KNOWLEDGE_BASE.irpp.bareme;
    return {
      type: 'irpp_rates',
      message: `**Barème IRPP 2025 (Personnes Physiques)**\n\n${bareme.map(b => `• **${b.tranche}** → ${b.taux}%`).join('\n')}\n\n**Seuil d'imposition :** ${TAX_KNOWLEDGE_BASE.irpp.seuil_imposition.toLocaleString('fr-TN')} DT\n\n**Déductions communes :**\n${TAX_KNOWLEDGE_BASE.irpp.deductions_communiques.map(d => `• ${d}`).join('\n')}`,
      data: bareme,
    };
  }

  if (q.includes('is') || q.includes('impôt sur les sociétés') || q.includes('société')) {
    return {
      type: 'is_rates',
      message: `**Impôt sur les Sociétés (IS) 2025**\n\n• **Taux normal :** ${TAX_KNOWLEDGE_BASE.is.taux_normal}%\n• **Établissements stables :** ${TAX_KNOWLEDGE_BASE.is.taux_etablissements_stables}%\n• **Banques & établissements financiers :** ${TAX_KNOWLEDGE_BASE.is.taux_banques}%\n• **Sociétés civiles :** ${TAX_KNOWLEDGE_BASE.is.taux_societes_civiles}%\n\n**Échéance déclaration :** ${TAX_KNOWLEDGE_BASE.is.declaraton.echeance}\n**Acomptes provisionnels :** ${TAX_KNOWLEDGE_BASE.is.declaraton.acomptes}\n\n**Provisions déductibles :**\n${TAX_KNOWLEDGE_BASE.is.provisions.map(p => `• ${p}`).join('\n')}`,
      data: TAX_KNOWLEDGE_BASE.is,
    };
  }

  if (q.includes('cnss') || q.includes('sécurité sociale') || q.includes('salari')) {
    return {
      type: 'cnss_rates',
      message: `**Cotisations CNSS 2025**\n\n• **Part employeur :** ${TAX_KNOWLEDGE_BASE.cnss.taux.employeur}%\n• **Part salarié :** ${TAX_KNOWLEDGE_BASE.cnss.taux.salarie}%\n• **Total :** ${TAX_KNOWLEDGE_BASE.cnss.taux.total}%\n• **Plafond mensuel :** ${TAX_KNOWLEDGE_BASE.cnss.plafond.mensuel.toLocaleString('fr-TN')} DT\n\n**Déclarations :**\n${TAX_KNOWLEDGE_BASE.cnss.declarations.map(d => `• **${d.type}** — ${d.echeance}`).join('\n')}`,
      data: TAX_KNOWLEDGE_BASE.cnss,
    };
  }

  if (q.includes('régime') || q.includes('fiscal') && (q.includes('entreprise') || q.includes('société'))) {
    return {
      type: 'fiscal_regime',
      message: `**Régimes fiscaux des entreprises en Tunisie**\n\n${TAX_KNOWLEDGE_BASE.fiscalite_entreprises.map(r => `**${r.regime}**\n• Conditions : ${r.conditions}\n• Obligations : ${r.obligations.map(o => `→ ${o}`).join('\n  ')}`).join('\n\n')}`,
      data: TAX_KNOWLEDGE_BASE.fiscalite_entreprises,
    };
  }

  if (q.includes('déduction') || q.includes('déductible')) {
    return {
      type: 'deductions',
      message: `**Charges déductibles fiscalement**\n\n• Achats et approvisionnements\n• Frais de personnel (salaires + CNSS)\n• Loyer professionnel\n• Frais de transport et déplacement\n• Frais de télécommunications\n• Fournitures de bureau\n• Honoraires et consultations\n• Frais bancaires\n• Amortissements des immobilisations\n• Provisions fiscalement admises\n• Intérêts d'emprunt (sous conditions)\n• Dons et subventions (plafonnés)\n• Cadeaux d'affaires (plafonnés)\n\n⚠️ Les frais personnels et les amendes fiscales ne sont pas déductibles.`,
      data: null,
    };
  }

  if (q.includes('pénalité') || q.includes('amende') || q.includes('retard')) {
    return {
      type: 'penalties',
      message: `**Pénalités et sanctions fiscales**\n\n${TAX_KNOWLEDGE_BASE.tva.penalites.map(p => `• ${p}`).join('\n')}\n\n• Retard de paiement : 0.75% par mois\n• Défaut de déclaration IRPP/IS : 15% à 25%\n• Opposition à contrôle fiscal : 50% minimum\n• Amende pour absence de facture TEIF : 100-500 DT`,
      data: TAX_KNOWLEDGE_BASE.tva.penalites,
    };
  }

  if (q.includes('optimisation') || q.includes('économiser') || q.includes('réduire')) {
    return {
      type: 'optimization',
      message: `**Suggestions d'optimisation fiscale**\n\n✅ **Valorisez vos investissements** — Utilisez les amortissements accélérés pour les équipements\n✅ **Provisionnez vos créances** — Provisions pour créances douteuses fiscalement déductibles\n✅ **Optimisez la rémunération** — Mix salaire/dividendes pour réduire l'IRPP global\n✅ **Regroupez vos achats** — Centralisez les achats via une structure unique\n✅ **Utilisez le crédit-bail** — Leasing avec déduction des loyers\n✅ **Déclarez en ligne** — Bénéficiez d'un délai supplémentaire et réduisez les erreurs\n✅ **Contrôle TVA régulier** — Rapprochez mensuellement TVA collectée et déductible\n✅ **Documentez tout** — Constituez un dossier fiscal solide pour chaque déduction`,
      data: null,
    };
  }

  if (q.includes('risque') || q.includes('audit') || q.includes('contrôle')) {
    const totalRevenue = invoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
    const totalExpenses = expenses.reduce((s, e) => s + (e.totalAmount || 0), 0);
    const profitMargin = totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue * 100).toFixed(1) : 0;

    return {
      type: 'risk_analysis',
      message: `**Analyse des risques fiscaux**\n\n📊 **Résultats actuels :**\n• Chiffre d'affaires : ${totalRevenue.toLocaleString('fr-TN')} DT\n• Dépenses : ${totalExpenses.toLocaleString('fr-TN')} DT\n• Marge nette : ${profitMargin}%\n\n⚠️ **Points de vigilance :**\n${FISCAL_RISK_INDICATORS.map(r => `• [${r.severity === 'high' ? '🔴' : r.severity === 'medium' ? '🟡' : '🟢'}] ${r.label}`).join('\n')}\n\n💡 **Recommandation :** Un audit périodique permet de détecter les anomalies avant le contrôle fiscal. Utilisez le module Audit de Smart Comptable pour un scoring détaillé.`,
      data: { revenue: totalRevenue, expenses: totalExpenses, margin: profitMargin, indicators: FISCAL_RISK_INDICATORS },
    };
  }

  if (q.includes('timbre') || q.includes('timbre fiscal')) {
    return {
      type: 'stamp_duty',
      message: `**Droit de timbre (Timbre Fiscal)**\n\n• Timbre sur factures : 1 DT par facture (B2B)\n• Timbre sur quittances : 0.500 DT\n• Timbre sur chèques : 0.300 DT par chèque\n• Timbre d'enregistrement : Variable selon acte\n\n⚠️ Depuis la réforme de 2025, le timbre fiscal est maintenu pour les factures B2B au-delà de 100 DT.`,
      data: null,
    };
  }

  if (q.includes('retenue') || q.includes('rs') || q.includes('retenue à la source')) {
    return {
      type: 'withholding_tax',
      message: `**Retenue à la Source (RS)**\n\n• **Honoraires** : 5% (personnes physiques), 3% (personnes morales)\n• **Loyers** : 10% (personnes physiques)\n• **Dividendes** : 5% (personnes morales), 10% (personnes physiques)\n• **Intérêts** : 20%\n• **Travaux immobiliers** : 5%\n\nℹ️ La RS doit être reversée au Trésor avant le 20 du mois suivant.`,
      data: null,
    };
  }

  if (q.includes('fodec')) {
    return {
      type: 'fodec',
      message: `**FODEC (Fonds de Développement de la Compétitivité)**\n\n• Taux : 1% du montant HT\n• Applicable sur certains produits et prestations\n• La base FODEC sert au calcul de la TVA correspondante\n• Mention obligatoire sur les factures concernées`,
      data: null,
    };
  }

  if (q.includes('amortissement') || q.includes('amortir')) {
    return {
      type: 'amortissement',
      message: `**Amortissements fiscalement déductibles**\n\n• **Constructions** : 5% linéaire\n• **Matériel et outillage** : 10-20% linéaire\n• **Matériel informatique** : 33.33% linéaire (dégressif possible)\n• **Véhicules** : 20% linéaire (plafonné à 150 000 DT)\n• **Frais d'établissement** : 20% linéaire\n• **Brevets et licences** : 20% linéaire\n\n💡 **Option dégressif possible** pour les biens neufs d'une durée ≥ 3 ans.`,
      data: null,
    };
  }

  if (q.includes('teif') || q.includes('facture électronique') || q.includes('facturation')) {
    return {
      type: 'teif',
      message: `**Facturation Électronique TEIF (v1.8.8)**\n\n📅 **Calendrier d'obligation :**\n• Depuis 2025 : B2B obligatoire pour tous les assujettis\n• Sanction : 100-500 DT par facture non conforme\n\n**Processus TEIF :**\n1️⃣ Génération du fichier XML conforme\n2️⃣ Signature électronique\n3️⃣ Transmission au TTN\n4️⃣ Validation par le client\n5️⃣ Archivage fiscal (10 ans)\n\n**Smart Comptable** gère automatiquement tout le processus TEIF !`,
      data: null,
    };
  }

  return {
    type: 'general',
    message: `**Assistant Fiscal IA Smart Comptable**\n\n🤖 Je suis votre conseiller fiscal virtuel spécialisé dans la fiscalité tunisienne.\n\n**Questions possibles :**\n• Taux de TVA, déclarations, déductions\n• Barème IRPP 2025\n• Impôt sur les Sociétés (IS)\n• Cotisations CNSS\n• Régimes fiscaux\n• Retenue à la source\n• Facturation TEIF\n• Optimisation fiscale\n• Risques et conformité\n• Amortissements, FODEC, timbre fiscal\n\n**💡 Astuce :** Utilisez les suggestions rapides ci-dessous pour démarrer !`,
    data: null,
  };
}

export function getSuggestedPrompts() {
  return [
    { icon: '💰', label: 'Taux de TVA', query: 'Quels sont les taux de TVA en Tunisie ?' },
    { icon: '📊', label: 'Barème IRPP', query: 'Quel est le barème IRPP 2025 ?' },
    { icon: '🏢', label: 'Impôt Société', query: 'Comment calculer l\'IS ?' },
    { icon: '⚠️', label: 'Risques fiscaux', query: 'Quels sont mes risques fiscaux actuels ?' },
    { icon: '📋', label: 'Déclarations TVA', query: 'Comment déclarer la TVA ?' },
    { icon: '🔍', label: 'Optimisation', query: 'Comment réduire mes impôts légalement ?' },
    { icon: '📄', label: 'TEIF', query: 'Comment fonctionne la facture électronique TEIF ?' },
    { icon: '🏛️', label: 'CNSS', query: 'Quels sont les taux CNSS 2025 ?' },
    { icon: '🧮', label: 'Calculer mon IRPP', query: 'Calcule mon IRPP pour 50000 DT' },
    { icon: '📈', label: 'Calculer mon IS', query: 'Calcule mon IS sur 120000 DT' },
  ];
}

export function calculateTaxForecast(invoices = [], expenses = [], months = 6) {
  const monthly = [];
  const now = new Date();
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    monthly.push({
      month: d.toLocaleString('fr-FR', { month: 'short', year: 'numeric' }),
      revenue: 0,
      expenses: 0,
      tvaCollected: 0,
      tvaDeductible: 0,
      tvaDue: 0,
    });
  }
  invoices.forEach(inv => {
    const d = new Date(inv.issueDate);
    const idx = ((d.getFullYear() - now.getFullYear()) * 12) + (d.getMonth() - now.getMonth());
    if (idx >= 0 && idx < months) {
      monthly[idx].revenue += inv.totalAmount || 0;
      monthly[idx].tvaCollected += inv.vatAmount || 0;
    }
  });
  expenses.forEach(exp => {
    const d = new Date(exp.date);
    const idx = ((d.getFullYear() - now.getFullYear()) * 12) + (d.getMonth() - now.getMonth());
    if (idx >= 0 && idx < months) {
      monthly[idx].expenses += exp.totalAmount || 0;
      monthly[idx].tvaDeductible += (exp.totalAmount || 0) * 0.19 / 1.19;
    }
  });
  monthly.forEach(m => {
    m.tvaDue = Math.max(0, m.tvaCollected - m.tvaDeductible);
  });
  return monthly;
}

export function getFiscalAlerts() {
  return [
    { id: 'tva_monthly', type: 'tva', title: 'Déclaration TVA mensuelle', dueDay: 20, severity: 'high' },
    { id: 'tva_quarterly', type: 'tva', title: 'Déclaration TVA trimestrielle', dueDay: 20, severity: 'high' },
    { id: 'cnss_monthly', type: 'cnss', title: 'Déclaration CNSS mensuelle', dueDay: 28, severity: 'high' },
    { id: 'is_annual', type: 'is', title: 'Déclaration annuelle IS', dueDay: 31, month: 3, severity: 'high' },
    { id: 'is_acompte1', type: 'is', title: '1er Acompte provisionnel IS', dueDay: 30, month: 6, severity: 'medium' },
    { id: 'is_acompte2', type: 'is', title: '2ème Acompte provisionnel IS', dueDay: 30, month: 9, severity: 'medium' },
    { id: 'is_acompte3', type: 'is', title: '3ème Acompte provisionnel IS', dueDay: 30, month: 12, severity: 'medium' },
    { id: 'irpp_annual', type: 'irpp', title: 'Déclaration annuelle IRPP', dueDay: 31, month: 3, severity: 'high' },
    { id: 'rs_monthly', type: 'rs', title: 'Reversement Retenue à la Source', dueDay: 20, severity: 'high' },
    { id: 'teif_weekly', type: 'teif', title: 'Vérification TEIF en attente', dueDay: 7, severity: 'low' },
  ];
}

export function calculateFiscalHealthScore(invoices = [], expenses = [], transactions = []) {
  let score = 100;
  const details = [];

  const totalRevenue = invoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (e.totalAmount || 0), 0);

  if (totalRevenue > 0) {
    const overdueRatio = invoices.filter(i => i.status === 'OVERDUE').length / invoices.length;
    if (overdueRatio > 0.2) { score -= 10; details.push({ reason: 'Trop de factures en retard', impact: -10 }); }
  }

  const expenseRatio = totalRevenue > 0 ? totalExpenses / totalRevenue : 0;
  if (expenseRatio > 0.9) { score -= 15; details.push({ reason: 'Marge bénéficiaire trop faible (<10%)', impact: -15 }); }
  else if (expenseRatio > 0.8) { score -= 5; details.push({ reason: 'Marge bénéficiaire réduite', impact: -5 }); }

  const sentInvoices = invoices.filter(i => i.status === 'SENT');
  if (sentInvoices.length > 5) { score -= 5; details.push({ reason: 'Factures envoyées non payées', impact: -5 }); }

  if (invoices.length === 0 && expenses.length === 0) {
    score = 50;
    details.push({ reason: 'Aucune activité comptable enregistrée', impact: -50 });
  }

  const companyId = localStorage.getItem('smart_comptable_current_id');
  const teifKey = companyId ? `teifStatusMap_${companyId}` : 'teifStatusMap';
  const teifCount = Object.keys(JSON.parse(localStorage.getItem(teifKey) || '{}')).length;
  if (teifCount === 0 && invoices.length > 3) {
    score -= 5;
    details.push({ reason: 'Factures sans transmission TEIF', impact: -5 });
  }

  return {
    score: Math.max(0, score),
    details,
    level: score >= 80 ? 'Excellent' : score >= 60 ? 'Attention' : 'Risqué',
    levelColor: score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-red-400',
  };
}
