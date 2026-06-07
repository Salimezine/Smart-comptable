import React from 'react';
import { can } from '../utils/auth/permissionEngine';
import { useAuth } from '../hooks/useAuth';

const MODULE_PERMISSION_MAP = {
  dashboard: 'view_all',
  journal: 'view_journal',
  paie: 'view_all',
  audit: 'run_audit',
  admin: 'manage_users',
  factures: 'create_invoice',
  expenses: 'create_expense',
  ocr: 'scan_ocr',
  manual: 'create_journal_entry',
  bilan: 'view_bilan',
};

export default function PermissionGuard({ module, action = 'view', permission, fallback = null, children }) {
  const { currentUser } = useAuth();
  if (!currentUser) return fallback;
  const perm = permission || MODULE_PERMISSION_MAP[module];
  if (perm && !can(currentUser, perm)) return fallback;
  return <>{children}</>;
}
