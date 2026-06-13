const ALERTS_CONFIG = [
  { id: 'tva_monthly', type: 'tva', title: 'Déclaration TVA mensuelle', description: 'Déclaration et paiement de la TVA du mois précédent', dueDay: 20, frequency: 'monthly', severity: 'critical', icon: '💰' },
  { id: 'tva_quarterly', type: 'tva', title: 'Déclaration TVA trimestrielle', description: 'Déclaration TVA du trimestre écoulé', dueDay: 20, frequency: 'quarterly', severity: 'critical', icon: '💰' },
  { id: 'cnss_monthly', type: 'cnss', title: 'Déclaration CNSS mensuelle', description: 'Déclaration et paiement des cotisations CNSS', dueDay: 28, frequency: 'monthly', severity: 'high', icon: '👥' },
  { id: 'cnss_301', type: 'cnss', title: 'État 301 CNSS', description: 'Déclaration annuelle récapitulative CNSS', dueDay: 31, dueMonth: 1, frequency: 'yearly', severity: 'high', icon: '📋' },
  { id: 'is_annual', type: 'is', title: 'Déclaration annuelle IS', description: 'Déclaration de l\'Impôt sur les Sociétés', dueDay: 31, dueMonth: 3, frequency: 'yearly', severity: 'critical', icon: '🏢' },
  { id: 'is_acompte1', type: 'is', title: '1er acompte provisionnel IS', description: '30% de l\'IS estimé de l\'exercice', dueDay: 25, dueMonth: 6, frequency: 'yearly', severity: 'high', icon: '📊' },
  { id: 'is_acompte2', type: 'is', title: '2ème acompte provisionnel IS', description: '30% de l\'IS estimé de l\'exercice', dueDay: 25, dueMonth: 9, frequency: 'yearly', severity: 'high', icon: '📊' },
  { id: 'is_acompte3', type: 'is', title: '3ème acompte provisionnel IS', description: '40% de l\'IS estimé de l\'exercice', dueDay: 25, dueMonth: 12, frequency: 'yearly', severity: 'high', icon: '📊' },
  { id: 'irpp_annual', type: 'irpp', title: 'Déclaration annuelle IRPP', description: 'Déclaration des revenus et paiement de l\'IRPP', dueDay: 31, dueMonth: 3, frequency: 'yearly', severity: 'critical', icon: '👤' },
  { id: 'rs_monthly', type: 'rs', title: 'Reversement Retenue à la Source', description: 'Reversement de la RS collectée au Trésor', dueDay: 20, frequency: 'monthly', severity: 'high', icon: '🔍' },
  { id: 'teif', type: 'teif', title: 'Transmission TEIF', description: 'Vérifier les factures en attente de transmission TTN', dueDay: 15, frequency: 'weekly', severity: 'medium', icon: '📄' },
  { id: 'bilan_annual', type: 'bilan', title: 'Dépôt du Bilan annuel', description: 'Dépôt des états financiers annuels', dueDay: 30, dueMonth: 4, frequency: 'yearly', severity: 'critical', icon: '📚' },
];

export function getActiveAlerts(companyContext = {}) {
  const now = new Date();
  const today = now.getDate();
  const currentMonth = now.getMonth(); // 0-indexed
  const currentYear = now.getFullYear();
  const alerts = [];

  for (const config of ALERTS_CONFIG) {
    let dueDate = null;
    let daysLeft = null;

    if (config.frequency === 'monthly') {
      let dueMonth = currentMonth;
      let dueYear = currentYear;
      if (today > config.dueDay) {
        dueMonth = currentMonth + 1;
        if (dueMonth > 11) { dueMonth = 0; dueYear += 1; }
      }
      dueDate = new Date(dueYear, dueMonth, config.dueDay);
      daysLeft = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
    } else if (config.frequency === 'quarterly') {
      const quarter = Math.floor(currentMonth / 3);
      const quarterEndMonths = [2, 5, 8, 11];
      let dueMonth = quarterEndMonths[quarter];
      let dueYear = currentYear;
      if (today > config.dueDay && currentMonth >= dueMonth) {
        dueMonth = quarterEndMonths[(quarter + 1) % 4];
        if (quarter === 3) dueYear += 1;
      }
      dueDate = new Date(dueYear, dueMonth, config.dueDay);
      daysLeft = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
    } else if (config.frequency === 'yearly') {
      const dueMonth = (config.dueMonth || 3) - 1;
      let dueYear = currentYear;
      if (currentMonth > dueMonth || (currentMonth === dueMonth && today > config.dueDay)) {
        dueYear += 1;
      }
      dueDate = new Date(dueYear, dueMonth, config.dueDay);
      daysLeft = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
    } else if (config.frequency === 'weekly') {
      const dayOfWeek = now.getDay();
      const daysUntilDue = (config.dueDay - dayOfWeek + 7) % 7;
      dueDate = new Date(now);
      dueDate.setDate(now.getDate() + (daysUntilDue || 7));
      daysLeft = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
    }

    if (daysLeft !== null) {
      let status = 'upcoming';
      let urgency = 'normal';
      if (daysLeft <= 0) { status = 'overdue'; urgency = 'critical'; }
      else if (daysLeft <= 3) { urgency = 'urgent'; }
      else if (daysLeft <= 7) { urgency = 'soon'; }

      alerts.push({
        ...config,
        dueDate: dueDate.toISOString().split('T')[0],
        daysLeft,
        status,
        urgency,
        formattedDate: dueDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
      });
    }
  }

  alerts.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return (order[a.severity] || 99) - (order[b.severity] || 99);
  });

  // Exclude dismissed/marked alerts
  const marked = getMarkedAlertIds();
  return alerts.filter(a => !marked.has(a.id));
}

const MARKED_KEY = 'smart_comptable_dismissed_alerts';

function getMarkedAlertIds() {
  try {
    const raw = localStorage.getItem(MARKED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function saveMarkedAlertIds(ids) {
  localStorage.setItem(MARKED_KEY, JSON.stringify([...ids]));
}

export function markAlert(alertId) {
  const ids = getMarkedAlertIds();
  ids.add(alertId);
  saveMarkedAlertIds(ids);
}

export function isAlertMarked(alertId) {
  return getMarkedAlertIds().has(alertId);
}

export function resetAllAlerts() {
  localStorage.removeItem(MARKED_KEY);
}

export function getAlertStats(alerts) {
  return {
    total: alerts.length,
    overdue: alerts.filter(a => a.status === 'overdue').length,
    dueSoon: alerts.filter(a => a.status === 'upcoming' && a.daysLeft <= 7).length,
    upcoming: alerts.filter(a => a.status === 'upcoming' && a.daysLeft > 7).length,
  };
}

export function getAlertColor(severity) {
  const colors = {
    critical: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', dot: 'bg-red-400' },
    high: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20', dot: 'bg-orange-400' },
    medium: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', dot: 'bg-amber-400' },
    low: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', dot: 'bg-blue-400' },
  };
  return colors[severity] || colors.medium;
}
