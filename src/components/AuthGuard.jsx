import React, { useContext, createContext } from 'react';
import { useAuth } from '../hooks/useAuth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const auth = useAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}

export default function AuthGuard({ permission, limitKey, children, fallback }) {
  const auth = useAuthContext();

  if (permission && !auth.can(permission)) {
    return fallback || (
      <div className="p-3 bg-slate-800/40 border border-slate-700/50 rounded-xl text-center">
        <p className="text-xs text-slate-500">Accès restreint — Rôle insuffisant</p>
      </div>
    );
  }

  if (limitKey) {
    const result = auth.checkLimit(limitKey);
    if (!result.allowed) {
      return (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 text-xs">
          {result.reason}
          <span className="ml-2 text-violet-400 underline cursor-pointer">Upgrader le plan</span>
        </div>
      );
    }
  }

  return <>{children}</>;
}
