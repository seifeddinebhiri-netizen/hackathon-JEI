import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../hooks/useAuth';

/** Protège les routes App : redirige vers /connexion en gardant la page demandée. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) {
    return <Navigate to="/connexion" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  return <>{children}</>;
}
