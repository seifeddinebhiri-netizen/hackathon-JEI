import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { loginPath } from '../redirect';

/** Protège les routes App : redirige vers /connexion?suite=<page demandée>. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, initializing } = useAuth();
  const location = useLocation();
  if (initializing) return null; // la session enregistrée est en cours de lecture
  if (!user) {
    return <Navigate to={loginPath(`${location.pathname}${location.search}${location.hash}`)} replace />;
  }
  return <>{children}</>;
}
