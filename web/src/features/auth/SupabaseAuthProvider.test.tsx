import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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
    emit: (s: unknown) => listener?.('SIGNED_IN', s),
    client: {
      auth: {
        getSession: vi.fn(async () => ({ data: { session: null } })),
        onAuthStateChange: vi.fn((cb: (event: string, s: unknown) => void) => {
          listener = cb;
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        }),
        signInWithPassword: vi.fn(async () => ({ error: null })),
        signOut: vi.fn(),
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
    render(
      <SupabaseAuthProvider>
        <Probe />
      </SupabaseAuthProvider>,
    );
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
