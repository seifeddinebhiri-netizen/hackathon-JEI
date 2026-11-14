/**
 * Faux fournisseur d'authentification, avec la MÊME interface que la future intégration Supabase :
 * user, session, signIn(email, password), signInDemo(), signOut().
 * Voir docs/INTEGRATION.md pour le remplacer par supabase.auth.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { addDays, formatISO } from 'date-fns';
import { setAuthTokenGetter } from '@/api/client';
import type { Session, User } from '@/api/types';
import { DEMO_PROJECT_ID } from '@/api/mocks/data/project';
import { AuthContext, type AuthContextValue } from './context';

const KEY = 'pp-session-v1';


function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    return new Date(s.expires_at) > new Date() ? s : null;
  } catch {
    return null;
  }
}

function makeSession(user: User): Session {
  return {
    access_token: `demo.${user.id}.${Math.random().toString(36).slice(2)}`,
    expires_at: formatISO(addDays(new Date(), 7)),
    user,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => readSession());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setAuthTokenGetter(() => session?.access_token ?? null);
  }, [session]);

  const save = useCallback((s: Session | null) => {
    setSession(s);
    setAuthTokenGetter(() => s?.access_token ?? null);
    try {
      if (s) localStorage.setItem(KEY, JSON.stringify(s));
      else localStorage.removeItem(KEY);
    } catch {
      /* stockage indisponible : session en mémoire */
    }
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      try {
        await new Promise((r) => setTimeout(r, 500));
        if (!email.includes('@') || password.length < 6) {
          throw new Error('Email ou mot de passe incorrect.');
        }
        const local = email.split('@')[0];
        const name = local.charAt(0).toUpperCase() + local.slice(1);
        save(makeSession({ id: `u-${local}`, email, name, is_demo: false, project_id: DEMO_PROJECT_ID }));
      } finally {
        setLoading(false);
      }
    },
    [save],
  );

  const signInDemo = useCallback(async () => {
    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 300));
      save(makeSession({ id: 'u-demo', email: 'demo@premierplan.invalid', name: 'Yassine', is_demo: true, project_id: DEMO_PROJECT_ID }));
    } finally {
      setLoading(false);
    }
  }, [save]);

  const signOut = useCallback(async () => {
    save(null);
  }, [save]);

  const value = useMemo<AuthContextValue>(
    () => ({ user: session?.user ?? null, session, loading, signIn, signInDemo, signOut }),
    [session, loading, signIn, signInDemo, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
