/**
 * Authentification réelle (Supabase Auth). Même interface que le faux fournisseur (context.ts).
 * Le jeton d'accès est envoyé au backend FastAPI dans `Authorization: Bearer ...` (api/client.ts).
 */
import type { Session as SbSession, User as SbUser } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { setAuthTokenGetter } from '@/api/client';
import { DEMO_PROJECT_ID } from '@/api/mocks/data/project';
import type { Session } from '@/api/types';
import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import { authErrorMessage } from './authErrors';
import { AuthContext, type AuthContextValue } from './context';

const PROJECT_KEY = 'pp-current-project';

function readProject(): string | undefined {
  try {
    return localStorage.getItem(PROJECT_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function displayName(u: SbUser): string {
  const meta = u.user_metadata?.name;
  if (typeof meta === 'string' && meta.trim()) return meta.trim();
  const local = (u.email ?? 'toi').split('@')[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [sb, setSb] = useState<SbSession | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [projectId, setProjectId] = useState<string | undefined>(readProject);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSb(data.session);
      setAuthTokenGetter(() => data.session?.access_token ?? null);
      setInitializing(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSb(next);
      setAuthTokenGetter(() => next?.access_token ?? null); // jeton rafraîchi automatiquement
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const session = useMemo<Session | null>(() => {
    if (!sb) return null;
    return {
      access_token: sb.access_token,
      // Supabase fournit toujours l'expiration (en secondes) ; le rafraîchissement est automatique.
      expires_at: sb.expires_at ? new Date(sb.expires_at * 1000).toISOString() : '',
      user: {
        id: sb.user.id,
        email: sb.user.email ?? '',
        name: displayName(sb.user),
        is_demo: !!env.demoEmail && sb.user.email === env.demoEmail,
        // Projets simulés tant que /projects n'est pas branché : le projet de démonstration.
        project_id: env.useMocks ? DEMO_PROJECT_ID : projectId,
      },
    };
  }, [sb, projectId]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Connexion indisponible.');
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(authErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    if (!supabase) throw new Error('Connexion indisponible.');
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
      if (error) throw new Error(authErrorMessage(error));
      return data.session ? ('signed_in' as const) : ('confirm_email' as const);
    } finally {
      setLoading(false);
    }
  }, []);

  const signInDemo = useCallback(async () => {
    if (!env.demoEmail || !env.demoPassword) throw new Error('Compte de démonstration non configuré.');
    await signIn(env.demoEmail, env.demoPassword);
  }, [signIn]);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, []);

  const setCurrentProject = useCallback((id: string) => {
    setProjectId(id);
    try {
      localStorage.setItem(PROJECT_KEY, id);
    } catch {
      /* stockage indisponible : valable pour cette session seulement */
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      initializing,
      authMode: 'supabase',
      canSignUp: true,
      demoAvailable: !!env.demoEmail && !!env.demoPassword,
      signIn,
      signUp,
      signInDemo,
      signOut,
      setCurrentProject,
    }),
    [session, loading, initializing, signIn, signUp, signInDemo, signOut, setCurrentProject],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
