import { getCurrentUser } from '../security/sessionManager';
import { getUserById } from './userStore';

export const ROLES = ['admin', 'comptable', 'readonly'];

export const ROLE_PERMISSIONS = {
  admin: {
    dashboard: { view: true },
    journal: { view: true, edit: true, delete: true },
    paie: { view: true, edit: true, validate: true },
    bilan: { view: true, export: true },
    factures: { view: true, edit: true, delete: true },
    audit: { view: true, export: true },
    admin: { view: true, edit: true },
    companies: { view: true, create: true, edit: true, delete: true },
    backup: { export: true, import: true },
  },
  comptable: {
    dashboard: { view: true },
    journal: { view: true, edit: true, delete: false },
    paie: { view: true, edit: true, validate: false },
    bilan: { view: true, export: true },
    factures: { view: true, edit: true, delete: false },
    audit: { view: false },
    admin: { view: false },
    companies: { view: true, create: false },
    backup: { export: true, import: false },
  },
  readonly: {
    dashboard: { view: true },
    journal: { view: true, edit: false },
    paie: { view: true, edit: false },
    bilan: { view: true, export: false },
    factures: { view: true, edit: false },
    audit: { view: false },
    admin: { view: false },
    companies: { view: true, create: false },
    backup: { export: false, import: false },
  },
};

export function getUserPermissions(user) {
  if (!user) return {};
  const defaults = ROLE_PERMISSIONS[user.role] || ROLE_PERMISSIONS.readonly;
  const override = user.permissions || {};
  const merged = {};
  for (const [module, perms] of Object.entries(defaults)) {
    merged[module] = { ...perms, ...(override[module] || {}) };
  }
  return merged;
}

export function can(user, module, action = 'view') {
  if (!user) return false;
  const perms = getUserPermissions(user);
  return perms[module]?.[action] === true;
}

export function filterModules(user, allModules) {
  if (!user) return [];
  return allModules.filter(m => can(user, m.id, 'view'));
}

export function usePermission(module) {
  // Hook-friendly version — call from component
  const userId = getCurrentUser();
  if (!userId) return { canView: false, canEdit: false, canDelete: false };
  try {
    const user = getUserById(userId);
    if (!user) return { canView: false, canEdit: false, canDelete: false };
    return {
      canView: can(user, module, 'view'),
      canEdit: can(user, module, 'edit'),
      canDelete: can(user, module, 'delete'),
    };
  } catch {
    return { canView: true, canEdit: true, canDelete: true };
  }
}
