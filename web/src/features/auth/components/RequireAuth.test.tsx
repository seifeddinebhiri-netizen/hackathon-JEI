import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import Login from '@/routes/Login';
import { GOOD_PASSWORD } from '@/test/authFixtures';
import { FakeAuth } from '@/test/fakeAuth';
import { RequireAuth } from './RequireAuth';

function Where() {
  const l = useLocation();
  return <p data-testid="ici">{`${l.pathname}${l.search}`}</p>;
}

function setup(start: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/connexion',
        element: (
          <>
            <Login />
            <Where />
          </>
        ),
      },
      {
        path: '*',
        element: (
          <RequireAuth>
            <p>Page privée</p>
            <Where />
          </RequireAuth>
        ),
      },
    ],
    { initialEntries: [start] },
  );
  render(
    <FakeAuth>
      <RouterProvider router={router} />
    </FakeAuth>,
  );
}

describe('page privée sans compte', () => {
  it('renvoie vers /connexion?suite=… puis revient à la page demandée', async () => {
    setup('/planner/jour/2026-11-21?vue=liste');
    expect(screen.getByTestId('ici').textContent).toBe(
      '/connexion?suite=%2Fplanner%2Fjour%2F2026-11-21%3Fvue%3Dliste',
    );
    await userEvent.type(screen.getByLabelText(/Email/), 'y@encadre.test');
    await userEvent.type(screen.getByLabelText(/Mot de passe/), 'mauvais');
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email ou mot de passe incorrect.');

    await userEvent.clear(screen.getByLabelText(/Mot de passe/));
    await userEvent.type(screen.getByLabelText(/Mot de passe/), GOOD_PASSWORD);
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect(await screen.findByText('Page privée')).toBeInTheDocument();
    expect(screen.getByTestId('ici').textContent).toBe('/planner/jour/2026-11-21?vue=liste');
  });

  it('?suite= vers un autre site : retour sur /projet', async () => {
    setup('/connexion?suite=https%3A%2F%2Fpirate.example');
    await userEvent.type(screen.getByLabelText(/Email/), 'y@encadre.test');
    await userEvent.type(screen.getByLabelText(/Mot de passe/), GOOD_PASSWORD);
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect(await screen.findByText('Page privée')).toBeInTheDocument();
    expect(screen.getByTestId('ici').textContent).toBe('/projet');
  });

  it('propose « Mot de passe oublié ? »', () => {
    setup('/connexion');
    expect(screen.getByRole('link', { name: 'Mot de passe oublié ?' })).toHaveAttribute(
      'href',
      '/mot-de-passe-oublie',
    );
  });
});
