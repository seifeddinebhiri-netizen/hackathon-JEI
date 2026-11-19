/**
 * Authentification réelle (Supabase Auth). Même interface que le faux fournisseur (context.ts).
 * Le jeton d'accès est envoyé au backend FastAPI dans `Authorization: Bearer ...` (api/client.ts).
 */
import {
  isAuthRetryableFetchError,
  type Session as SbSession,
  type User as SbUser,
} from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { setAuthTokenGetter, setUnauthorizedHandler } from '@/api/client';
import { DEMO_PROJECT_ID } from '@/api/mocks/data/project';
import type { Session } from '@/api/types';
import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import { authErrorMessage } from './authErrors';
import { resetPasswordRedirect } from './redirect';
import { AuthContext, type AuthContextValue } from './context';

// Projet courant, par compte : un autre compte ouvert dans ce navigateur garde le sien.
const projectKey = (userId: string) => `pp-current-project:${userId}`;

function readProject(userId: string): string | undefined {
  try {
    return localStorage.getItem(projectKey(userId)) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Projet ouvert par défaut, enregistré dans le profil (création du projet, compte de démo). */
async function profileProject(userId: string): Promise<string | undefined> {
  if (!supabase) return undefined;
  const { data } = await supabase
    .from('profiles')
    .select('current_project_id')
    .eq('id', userId)
    .maybeSingle();
  const id = (data as { current_project_id?: string | null } | null)?.current_project_id;
  return id ?? undefined;
}

function displayName(u: SbUser): string {
  const meta = u.user_metadata?.name;
  if (typeof meta === 'string' && meta.trim()) return meta.trim();
  const local = (u.email ?? 'toi').split('@')[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [sb, setSb] = useState<SbSession | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading] = useState(false);
  // Projet courant du compte connecté (`userId` : pour quel compte il a été lu)
  const [current, setCurrent] = useState<{ userId: string; projectId?: string } | null>(null);
  const userId = sb?.user.id;
  // Compte dont les données sont en cache : un autre compte (ou aucun) vide le cache.
  const cachedFor = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      cachedFor.current = data.session?.user.id;
      setSb(data.session);
      setAuthTokenGetter(() => data.session?.access_token ?? null);
      setInitializing(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      const nextId = next?.user.id;
      if (cachedFor.current !== undefined && cachedFor.current !== nextId) queryClient.clear();
      cachedFor.current = nextId;
      setSb(next);
      setAuthTokenGetter(() => next?.access_token ?? null); // jeton rafraîchi automatiquement
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  // Le backend refuse le jeton (401) : on demande à Supabase de renouveler la session. S'il
  // confirme qu'elle n'est plus valable, on la ferme et RequireAuth renvoie vers
  // /connexion?suite=<page>. Si le renouvellement réussit, le jeton suivant passera ; s'il échoue
  // faute de réseau, on ne déconnecte personne. Une seule tentative à la fois, 30 s au moins entre deux.
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let pending = false;
    let last = 0;
    setUnauthorizedHandler(() => {
      if (pending || Date.now() - last < 30_000) return;
      pending = true;
      last = Date.now();
      void client.auth
        .refreshSession()
        .then(async ({ error }) => {
          if (error && !isAuthRetryableFetchError(error)) await client.auth.signOut({ scope: 'local' });
        })
        .catch(() => undefined)
        .finally(() => {
          pending = false;
        });
    });
    return () => setUnauthorizedHandler(() => {});
  }, []);

  useEffect(() => {
    if (!userId || env.useMocks) return;
    let alive = true;
    const local = readProject(userId);
    void (local ? Promise.resolve(local) : profileProject(userId).catch(() => undefined)).then(
      (projectId) => {
        if (alive) setCurrent({ userId, projectId });
      },
    );
    return () => {
      alive = false;
    };
  }, [userId]);
  const projectId = current?.userId === userId ? current?.projectId : undefined;
  // Le projet du compte est en cours de lecture : pas encore d'écran « Pas encore de film »
  const resolvingProject = !!userId && !env.useMocks && current?.userId !== userId;

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
    try {
      await supabase?.auth.signOut();
    } finally {
      cachedFor.current = undefined;
      queryClient.clear(); // rien du compte précédent ne reste en mémoire
    }
  }, [queryClient]);

  const requestPasswordReset = useCallback(async (email: string) => {
    if (!supabase) throw new Error('Connexion indisponible.');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: resetPasswordRedirect(),
    });
    if (error) throw new Error(authErrorMessage(error));
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    if (!supabase) throw new Error('Connexion indisponible.');
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error(authErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  const setCurrentProject = useCallback(
    (id: string) => {
      if (!userId) return;
      setCurrent({ userId, projectId: id });
      try {
        localStorage.setItem(projectKey(userId), id);
      } catch {
        /* stockage indisponible : valable pour cette session seulement */
      }
    },
    [userId],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      initializing: initializing || resolvingProject,
      authMode: 'supabase',
      canSignUp: true,
      demoAvailable: !!env.demoEmail && !!env.demoPassword,
      signIn,
      signUp,
      signInDemo,
      signOut,
      requestPasswordReset,
      updatePassword,
      setCurrentProject,
    }),
    [
      session,
      loading,
      initializing,
      resolvingProject,
      signIn,
      signUp,
      signInDemo,
      signOut,
      requestPasswordReset,
      updatePassword,
      setCurrentProject,
    ],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
