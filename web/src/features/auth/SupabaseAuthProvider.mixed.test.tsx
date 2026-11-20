import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sb = vi.hoisted(() => ({
  session: { access_token: 'jeton', expires_at: 9e9, user: { id: 'u1', email: 'moi@test.fr' } },
  client: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { current_project_id: 'projet-reel' } }) }),
      }),
    })),
  },
}));
vi.mock('@/lib/supabase', () => ({ supabase: sb.client, hasRealAuth: true }));

/** Charge le fournisseur avec une configuration d'environnement donnée (lue au chargement du module). */
async function load(useMocks: boolean, realEndpoints: string[]) {
  vi.resetModules();
  vi.doMock('@/lib/env', async (orig) => {
    const mod = await orig<typeof import('@/lib/env')>();
    return { ...mod, env: { ...mod.env, useMocks, realEndpoints, demoEmail: '', demoPassword: '' } };
  });
  const { SupabaseAuthProvider } = await import('./SupabaseAuthProvider');
  const { useAuth } = await import('./hooks/useAuth');
  function Probe() {
    const { user, initializing } = useAuth();
    return (
      <p>
        projet={user?.project_id ?? 'aucun'} chargement={String(initializing)}
      </p>
    );
  }
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SupabaseAuthProvider>
        <Probe />
      </SupabaseAuthProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sb.client.auth.getSession.mockResolvedValue({ data: { session: sb.session } });
});

describe('projet ouvert à la connexion', () => {
  it('tout réel (sans mocks) : le projet du compte, lu dans son profil', async () => {
    await load(false, []);
    await waitFor(() => expect(screen.getByText(/projet=projet-reel/)).toBeInTheDocument());
  });

  it('mocks sans rien de réel : le projet de démonstration, le profil n’est pas lu', async () => {
    await load(true, []);
    await waitFor(() => expect(screen.getByText(/projet=demo-maree-basse/)).toBeInTheDocument());
    expect(sb.client.from).not.toHaveBeenCalled();
  });

  it('mode mixte avec getProject réel : le projet du compte, JAMAIS la démo (sinon 404 côté serveur)', async () => {
    await load(true, ['getProject', 'createProject']);
    await waitFor(() => expect(screen.getByText(/projet=projet-reel/)).toBeInTheDocument());
    expect(screen.queryByText(/demo-maree-basse/)).toBeNull();
  });

  it('mode mixte sans getProject (festivals réels seulement) : la démonstration', async () => {
    await load(true, ['searchFestivals', 'getFestival']);
    await waitFor(() => expect(screen.getByText(/projet=demo-maree-basse/)).toBeInTheDocument());
  });
});
