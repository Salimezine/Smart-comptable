export const ROLES = ['admin', 'comptable', 'lecteur'];
export const ROLE_PERMISSIONS = PERMISSIONS;

export const PERMISSIONS = {
  admin: {
    label: "Administrateur",
    color: "violet",
    can: [
      "view_all",
      "create_invoice",
      "edit_invoice",
      "delete_invoice",
      "create_expense",
      "edit_expense",
      "delete_expense",
      "scan_ocr",
      "view_journal",
      "create_journal_entry",
      "view_bilan",
      "export_pdf",
      "export_excel",
      "run_audit",
      "manage_users",
      "manage_societe",
      "invite_users",
      "view_config",
      "switch_societe",
    ]
  },
  comptable: {
    label: "Comptable",
    color: "blue",
    can: [
      "view_all",
      "create_invoice",
      "edit_invoice",
      "create_expense",
      "edit_expense",
      "scan_ocr",
      "view_journal",
      "create_journal_entry",
      "view_bilan",
      "export_pdf",
      "export_excel",
      "run_audit",
    ]
  },
  lecteur: {
    label: "Lecteur",
    color: "gray",
    can: [
      "view_all",
      "view_journal",
      "view_bilan",
      "export_pdf",
    ]
  }
};

const PERMISSION_LABELS = {
  view_all: "Voir tout",
  create_invoice: "Créer factures",
  edit_invoice: "Modifier factures",
  delete_invoice: "Supprimer factures",
  create_expense: "Créer dépenses",
  edit_expense: "Modifier dépenses",
  delete_expense: "Supprimer dépenses",
  scan_ocr: "Scanner reçus",
  view_journal: "Voir journal",
  create_journal_entry: "Saisie manuelle",
  view_bilan: "Bilan & résultat",
  export_pdf: "Export PDF",
  export_excel: "Export Excel",
  run_audit: "Lancer audit",
  manage_users: "Gérer utilisateurs",
  manage_societe: "Modifier société",
  invite_users: "Inviter membres",
  view_config: "Configuration",
  switch_societe: "Changer société",
};

export function can(user, permission) {
  if (!user || !user.role) return false;
  const rolePerms = PERMISSIONS[user.role];
  if (!rolePerms) return false;
  return rolePerms.can.includes(permission);
}

export function filterModules(user, allModules) {
  if (!user) return [];
  return allModules.filter(m => {
    const permMap = {
      'dashboard': 'view_all',
      'invoicing': 'create_invoice',
      'expenses': 'create_expense',
      'journal': 'view_journal',
      'financial': 'view_bilan',
      'audit': 'run_audit',
      'ocr': 'scan_ocr',
      'manual': 'create_journal_entry',
      'admin': 'manage_users',
      'settings': 'view_config',
      'payroll': 'view_all',
      'bank': 'view_all',
      'stock': 'view_all',
      'suppliers': 'view_all',
      'fiscal': 'view_all',
      'workflow': 'view_all',
    };
    const perm = permMap[m.id] || 'view_all';
    return can(user, perm);
  });
}

export function getUserPermissions(user) {
  if (!user) return [];
  const rolePerms = PERMISSIONS[user.role];
  return rolePerms ? [...rolePerms.can] : [];
}

export function getPermissionLabel(perm) {
  return PERMISSION_LABELS[perm] || perm;
}
