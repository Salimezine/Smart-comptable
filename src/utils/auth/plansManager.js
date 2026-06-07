const PLANS_STORAGE_KEY = 'sc_plans_config';

export const PLANS = {
  free: {
    label: "Gratuit",
    price: "0 DT/mois",
    color: "gray",
    limits: {
      factures_par_mois: 5,
      depenses_par_mois: 10,
      societes: 1,
      membres: 1,
      scan_ocr_par_mois: 5,
      export_pdf: false,
      export_excel: false,
      audit: false,
      journal_manuel: false,
      bilan: false,
    }
  },
  starter: {
    label: "Starter",
    price: "29 DT/mois",
    color: "blue",
    limits: {
      factures_par_mois: 30,
      depenses_par_mois: 50,
      societes: 1,
      membres: 2,
      scan_ocr_par_mois: 30,
      export_pdf: true,
      export_excel: false,
      audit: true,
      journal_manuel: false,
      bilan: true,
    }
  },
  pro: {
    label: "Pro",
    price: "79 DT/mois",
    color: "violet",
    limits: {
      factures_par_mois: 200,
      depenses_par_mois: 500,
      societes: 3,
      membres: 5,
      scan_ocr_par_mois: 200,
      export_pdf: true,
      export_excel: true,
      audit: true,
      journal_manuel: true,
      bilan: true,
    }
  },
  enterprise: {
    label: "Enterprise",
    price: "199 DT/mois",
    color: "gold",
    limits: {
      factures_par_mois: Infinity,
      depenses_par_mois: Infinity,
      societes: Infinity,
      membres: Infinity,
      scan_ocr_par_mois: Infinity,
      export_pdf: true,
      export_excel: true,
      audit: true,
      journal_manuel: true,
      bilan: true,
    }
  }
};

export const PLAN_LIST = ['free', 'starter', 'pro', 'enterprise'];

export function getPlan(planId) {
  return PLANS[planId] || PLANS.free;
}

export function checkLimit(planId, limitKey, usageCount) {
  const plan = getPlan(planId);
  const limit = plan.limits[limitKey];

  if (limit === false) {
    return { allowed: false, reason: `Non disponible sur plan ${plan.label}` };
  }
  if (limit === Infinity) {
    return { allowed: true, remaining: Infinity };
  }
  if (usageCount >= limit) {
    return {
      allowed: false,
      reason: `Limite atteinte (${usageCount}/${limit}) - Upgrade vers plan supérieur`,
      usage: usageCount,
      limit
    };
  }
  return { allowed: true, remaining: limit - usageCount, usage: usageCount, limit };
}

export function canDowngrade(currentPlanId, targetPlanId, currentData) {
  const target = getPlan(targetPlanId);
  const current = getPlan(currentPlanId);

  if (target.limits.societes < currentData.societeCount) return false;
  if (target.limits.membres < currentData.membreCount) return false;

  return true;
}

export function getUpgradeSuggestions(currentPlanId) {
  const idx = PLAN_LIST.indexOf(currentPlanId);
  if (idx === -1 || idx >= PLAN_LIST.length - 1) return [];
  return PLAN_LIST.slice(idx + 1).map(id => ({ id, ...PLANS[id] }));
}
