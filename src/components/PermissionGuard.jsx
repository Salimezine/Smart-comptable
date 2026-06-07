import React from 'react';
import { can } from '../utils/auth/permissionEngine';
import { getCurrentUser } from '../utils/security/sessionManager';
import { getUserById } from '../utils/auth/userStore';

export default function PermissionGuard({ module, action = 'view', fallback = null, children }) {
  try {
    const userId = getCurrentUser();
    if (!userId) return fallback;
    const user = getUserById(userId);
    if (!user) return fallback;
    if (!can(user, module, action)) return fallback;
  } catch {
    return <>{children}</>;
  }
  return <>{children}</>;
}
