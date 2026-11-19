import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthContextValue } from '@/features/auth/context';
import { YASSINE } from '@/test/authFixtures';
import { FakeAuth } from '@/test/fakeAuth';
import ForgotPassword from './ForgotPassword';
import ResetPassword from './ResetPassword';

function show(
  element: React.ReactNode,
  opts: { user?: typeof YASSINE | null; overrides?: Partial<AuthContextValue> } = {},
) {
  const router = createMemoryRouter([{ path: '*', element }]);
  render(
    <FakeAuth initialUser={opts.user ?? null} overrides={opts.overrides}>
      <RouterProvider router={router} />
    </FakeAuth>,
  );
}

afterEach(() => window.history.replaceState(null, '', '/'));

describe('/mot-de-passe-oublie', () => {
  it('envoie le lien et répond pareil que le compte existe ou non', async () => {
    const requestPasswordReset = vi.fn(async () => undefined);
    show(<ForgotPassword />, { overrides: { requestPasswordReset } });
    await userEvent.type(screen.getByLabelText(/Email/), 'y@encadre.test');
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer le lien' }));
    expect(requestPasswordReset).toHaveBeenCalledWith('y@encadre.test');
    expect(await screen.findByRole('status')).toHaveTextContent('Si un compte existe pour y@encadre.test');
  });

  it('affiche la vraie raison d’un refus', async () => {
    show(<ForgotPassword />, {
      overrides: {
        requestPasswordReset: vi.fn(async () => Promise.reject(new Error('Trop d’emails envoyés.'))),
      },
    });
    await userEvent.type(screen.getByLabelText(/Email/), 'y@encadre.test');
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer le lien' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Trop d’emails envoyés.');
  });
});

describe('/nouveau-mot-de-passe', () => {
  it('lien expiré : le dit et propose un nouveau lien', () => {
    window.history.replaceState(null, '', '/nouveau-mot-de-passe#error=access_denied&error_code=otp_expired');
    show(<ResetPassword />);
    expect(screen.getByRole('alert')).toHaveTextContent(/a expiré/);
    expect(screen.getByRole('link', { name: /Recevoir un nouveau lien/ })).toHaveAttribute(
      'href',
      '/mot-de-passe-oublie',
    );
  });

  it('sans session de récupération : lien plus valable', () => {
    show(<ResetPassword />);
    expect(screen.getByRole('alert')).toHaveTextContent(/n’est plus valable/);
  });

  it('enregistre le nouveau mot de passe', async () => {
    const updatePassword = vi.fn(async () => undefined);
    show(<ResetPassword />, { user: YASSINE, overrides: { updatePassword } });
    await userEvent.type(
      screen.getByLabelText(/^Nouveau mot de passe/, { selector: 'input' }),
      'nouveau-secret',
    );
    await userEvent.type(screen.getByLabelText(/Confirme/), 'autre-chose');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Les deux mots de passe sont différents.')).toBeInTheDocument();
    expect(updatePassword).not.toHaveBeenCalled();

    await userEvent.clear(screen.getByLabelText(/Confirme/));
    await userEvent.type(screen.getByLabelText(/Confirme/), 'nouveau-secret');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(updatePassword).toHaveBeenCalledWith('nouveau-secret');
    expect(await screen.findByRole('status')).toHaveTextContent('Mot de passe enregistré');
  });
});
