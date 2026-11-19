import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, kitApi } from '@/api';
import { Toaster } from '@/components/ui';
import { YASSINE } from '@/test/authFixtures';
import { FakeAuth } from '@/test/fakeAuth';
import Dossiers from './festival/Dossiers';
import MyData from './MyData';
import Passport from './Passport';
import ProjectDashboard from './ProjectDashboard';

// Compte neuf : profiles.current_project_id = null → pas de projet courant
const NEW_ACCOUNT = { ...YASSINE, project_id: undefined };

function show(element: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: '*', element }]);
  render(
    <QueryClientProvider client={qc}>
      <Toaster>
        <FakeAuth initialUser={NEW_ACCOUNT}>
          <RouterProvider router={router} />
        </FakeAuth>
      </Toaster>
    </QueryClientProvider>,
  );
}

const spies = () => ({
  project: vi.spyOn(api, 'getProject'),
  passport: vi.spyOn(api, 'getProjectPassport'),
  kit: vi.spyOn(kitApi, 'getKit'),
});
let calls: ReturnType<typeof spies>;
beforeEach(() => {
  calls = spies();
});
afterEach(() => vi.restoreAllMocks());

describe('compte sans projet', () => {
  it.each([
    ['Projet', <ProjectDashboard />],
    ['Déclarer', <Passport />],
    ['Diffuser', <Dossiers />],
    ['Mes données', <MyData />],
  ])('%s : état vide, aucun squelette, aucun appel', (_name, element) => {
    show(element);
    expect(screen.getByRole('heading', { name: 'Bienvenue ! Tu n’as pas encore de projet.' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Créer mon premier projet' })).toHaveAttribute(
      'href',
      '/planner/projet?nouveau=1',
    );
    expect(screen.queryByText(/Chargement/)).not.toBeInTheDocument();
    expect(document.querySelector('.animate-pulse-soft')).toBeNull();
    expect(calls.project).not.toHaveBeenCalled();
    expect(calls.passport).not.toHaveBeenCalled();
    expect(calls.kit).not.toHaveBeenCalled();
  });
});
