import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { request } from '@/api/client';
import { useAuth } from './hooks/useAuth';

const sb = vi.hoisted(() => {
  let listener: ((event: string, session: unknown) => void) | null = null;
  const session = {
    access_token: 'jeton',
    expires_at: 9e9,
    user: { id: 'u-demo', email: 'demo@encadre.test' },
  };
  return {
    session,
    emit: (s: unknown, event = 'SIGNED_IN') => listener?.(event, s),
    client: {
      auth: {
        getSession: vi.fn(async () => ({ data: { session: null } })),
        onAuthStateChange: vi.fn((cb: (event: string, s: unknown) => void) => {
          listener = cb;
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        }),
        signInWithPassword: vi.fn(async () => ({ error: null })),
        signOut: vi.fn(async () => ({ error: null })),
        refreshSession: vi.fn(async (): Promise<{ error: unknown }> => ({ error: null })),
        resetPasswordForEmail: vi.fn(async (): Promise<{ error: unknown }> => ({ error: null })),
        updateUser: vi.fn(async (): Promise<{ error: unknown }> => ({ error: null })),
      },
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: { current_project_id: 'projet-demo' } }) }),
        }),
      })),
    },
  };
});
vi.mock('@/lib/supabase', () => ({ supabase: sb.client, hasRealAuth: true }));
vi.mock('@/lib/env', async (orig) => {
  const mod = await orig<typeof import('@/lib/env')>();
  return {
    ...mod,
    env: { ...mod.env, useMocks: false, demoEmail: 'demo@encadre.test', demoPassword: 'mot-de-passe-test' },
  };
});

const { SupabaseAuthProvider } = await import('./SupabaseAuthProvider');

function renderWithClient(ui: ReactNode, client = new QueryClient()) {
  render(
    <QueryClientProvider client={client}>
      <SupabaseAuthProvider>{ui}</SupabaseAuthProvider>
    </QueryClientProvider>,
  );
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

function Probe() {
  const { user, signInDemo, demoAvailable, initializing } = useAuth();
  return (
    <div>
      <button type="button" disabled={!demoAvailable} onClick={() => void signInDemo()}>
        Continuer en démo
      </button>
      <p data-testid="etat">{initializing ? 'lecture' : (user?.project_id ?? 'aucun')}</p>
    </div>
  );
}

describe('bouton « Continuer en démo » (Supabase)', () => {
  it('connecte le compte de démo en un clic et ouvre son projet', async () => {
    renderWithClient(<Probe />);
    await userEvent.click(screen.getByRole('button', { name: 'Continuer en démo' }));
    expect(sb.client.auth.signInWithPassword).toHaveBeenCalledTimes(1);
    expect(sb.client.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'demo@encadre.test',
      password: 'mot-de-passe-test',
    });
    act(() => sb.emit(sb.session));
    // Projet ouvert par défaut : celui du profil (posé par scripts/seed_kit_demo.py)
    await waitFor(() => expect(screen.getByTestId('etat').textContent).toBe('projet-demo'));
    expect(sb.client.from).toHaveBeenCalledWith('profiles');
  });
});

function Actions() {
  const { signOut, requestPasswordReset, updatePassword } = useAuth();
  const setError = (e: unknown) => {
    document.body.dataset.erreur = e instanceof Error ? e.message : String(e);
  };
  return (
    <div>
      <button type="button" onClick={() => void signOut()}>
        Se déconnecter
      </button>
      <button type="button" onClick={() => void requestPasswordReset('a@b.test').catch(setError)}>
        Lien
      </button>
      <button type="button" onClick={() => void updatePassword('nouveau-mdp').catch(setError)}>
        Enregistrer
      </button>
    </div>
  );
}

describe('déconnexion', () => {
  it('vide le cache des données', async () => {
    const client = new QueryClient();
    client.setQueryData(['project', 'p1'], { title: 'Film du compte A' });
    renderWithClient(<Actions />, client);
    await userEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }));
    expect(sb.client.auth.signOut).toHaveBeenCalled();
    expect(client.getQueryData(['project', 'p1'])).toBeUndefined();
  });

  it('un autre compte qui se connecte ne voit pas le cache du précédent', async () => {
    const client = new QueryClient();
    renderWithClient(<Probe />, client);
    act(() => sb.emit(sb.session));
    client.setQueryData(['project', 'p1'], { title: 'Film du compte A' });
    act(() => sb.emit({ ...sb.session, user: { id: 'u-autre', email: 'b@encadre.test' } }));
    expect(client.getQueryData(['project', 'p1'])).toBeUndefined();
  });

  it('le jeton renouvelé (même compte) garde le cache', async () => {
    const client = new QueryClient();
    renderWithClient(<Probe />, client);
    act(() => sb.emit(sb.session));
    client.setQueryData(['project', 'p1'], { title: 'Film' });
    act(() => sb.emit({ ...sb.session, access_token: 'jeton-2' }, 'TOKEN_REFRESHED'));
    expect(client.getQueryData(['project', 'p1'])).toEqual({ title: 'Film' });
  });
});

describe('mot de passe oublié', () => {
  it('envoie le lien vers /nouveau-mot-de-passe de ce site', async () => {
    renderWithClient(<Actions />);
    await userEvent.click(screen.getByRole('button', { name: 'Lien' }));
    expect(sb.client.auth.resetPasswordForEmail).toHaveBeenCalledWith('a@b.test', {
      redirectTo: `${window.location.origin}/nouveau-mot-de-passe`,
    });
  });

  it('enregistre le nouveau mot de passe et traduit l’erreur', async () => {
    sb.client.auth.updateUser.mockResolvedValueOnce({
      error: new AuthApiError('New password should be different', 422, 'same_password'),
    });
    renderWithClient(<Actions />);
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(sb.client.auth.updateUser).toHaveBeenCalledWith({ password: 'nouveau-mdp' });
    await waitFor(() => expect(document.body.dataset.erreur).toMatch(/différent de l’ancien/));
  });
});

describe('401 du backend', () => {
  // Compte connecté (jeton envoyé), puis le backend refuse ce jeton.
  async function backend401() {
    await waitFor(() => expect(screen.getByTestId('etat').textContent).not.toBe('lecture'));
    act(() => sb.emit(sb.session));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 401 })),
    );
    await request('/projects/x', { schema: z.unknown() }).catch(() => undefined);
  }

  it('session morte côté Supabase : déconnexion locale (RequireAuth renvoie vers /connexion)', async () => {
    sb.client.auth.refreshSession.mockResolvedValueOnce({
      error: new AuthApiError('Invalid Refresh Token', 400, 'refresh_token_not_found'),
    });
    renderWithClient(<Probe />);
    await backend401();
    await waitFor(() => expect(sb.client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' }));
  });

  it('session renouvelée : personne n’est déconnecté', async () => {
    renderWithClient(<Probe />);
    await backend401();
    await waitFor(() => expect(sb.client.auth.refreshSession).toHaveBeenCalled());
    expect(sb.client.auth.signOut).not.toHaveBeenCalled();
  });

  it('pas de réseau : personne n’est déconnecté', async () => {
    sb.client.auth.refreshSession.mockResolvedValueOnce({
      error: new AuthRetryableFetchError('Failed to fetch', 0),
    });
    renderWithClient(<Probe />);
    await backend401();
    await waitFor(() => expect(sb.client.auth.refreshSession).toHaveBeenCalled());
    expect(sb.client.auth.signOut).not.toHaveBeenCalled();
  });
});
