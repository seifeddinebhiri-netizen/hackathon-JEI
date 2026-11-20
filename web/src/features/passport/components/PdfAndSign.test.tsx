import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Passport } from '@/api';
import { Toaster } from '@/components/ui';
import { PdfAndSign } from './OutputsPanel';

const mocks = vi.hoisted(() => ({
  checkPassport: vi.fn(),
  getPassportPdfUrl: vi.fn(),
  getProjectPassport: vi.fn(),
}));
vi.mock('@/api', () => ({ api: mocks }));

const passport = (over: Partial<Passport> = {}): Passport => ({
  id: 'p1',
  project_id: 'p1',
  film_title: 'Dar Hmeti',
  director: 'Amira',
  declarations: [],
  c2pa_signed: false,
  badge_code: 'EN-ABCD-23',
  verify_url: 'https://x.example/verifier/EN-ABCD-23',
  updated_at: '2026-11-19T10:00:00Z',
  ...over,
});

function setup(p = passport()) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Toaster>
        <PdfAndSign passport={p} />
      </Toaster>
    </QueryClientProvider>,
  );
}

const open = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('open', open);
  mocks.checkPassport.mockResolvedValue({ ok: true, missing: [], warnings: [] });
});
afterEach(() => vi.unstubAllGlobals());

const generate = (name = 'Générer le PDF signé') => fireEvent.click(screen.getByRole('button', { name }));

describe('PDF signé du Passeport', () => {
  it('un seul bouton, plus de nom de fichier à saisir : on signe le PDF, pas le film', async () => {
    setup();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Générer le PDF signé' })).toBeEnabled());
    expect(screen.queryByText(/Nom du fichier final/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Signer/ })).toBeNull();
    expect(screen.getByText(/pas que les déclarations/)).toBeInTheDocument();
  });

  it('bloqué tant que le contrôle des déclarations n’est pas bon, avec ce qui manque', async () => {
    mocks.checkPassport.mockResolvedValue({
      ok: false,
      missing: [{ department: 'image', message: 'Réponds pour le département Image.' }],
      warnings: [],
    });
    setup();
    expect(await screen.findByText('Réponds pour le département Image.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Générer le PDF signé' })).toBeDisabled();
  });

  it('signature de test : le PDF s’ouvre et la page dit honnêtement ce que ça vaut', async () => {
    mocks.getPassportPdfUrl.mockResolvedValue({
      url: 'blob:pdf-1',
      signed: true,
      simulated: true,
      manifest_id: 'urn:c2pa:abc',
    });
    setup();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Générer le PDF signé' })).toBeEnabled());
    generate();
    await waitFor(() => expect(open).toHaveBeenCalledWith('blob:pdf-1', '_blank', 'noopener'));
    expect(mocks.getPassportPdfUrl).toHaveBeenCalledWith('p1');
    expect(await screen.findByText('PDF signé (signature de test)')).toBeInTheDocument();
    expect(screen.getByText(/signataire inconnu/)).toBeInTheDocument();
  });

  it('signature de production : aucun avertissement « test »', async () => {
    mocks.getPassportPdfUrl.mockResolvedValue({ url: 'blob:pdf-2', signed: true, simulated: false });
    setup();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Générer le PDF signé' })).toBeEnabled());
    generate();
    expect(await screen.findByText('PDF signé (C2PA)')).toBeInTheDocument();
    expect(screen.queryByText(/signature de test/)).toBeNull();
  });

  it('mode démonstration (aperçu imprimable) : le PDF s’ouvre sans prétendre être signé', async () => {
    mocks.getPassportPdfUrl.mockResolvedValue({ url: 'https://x.example/verifier/p1?imprimer=1' });
    setup();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Générer le PDF signé' })).toBeEnabled());
    generate();
    await waitFor(() => expect(open).toHaveBeenCalled());
    expect(screen.queryByText(/PDF signé \(/)).toBeNull();
  });

  it('erreur du serveur (signature non configurée, limite…) : le message s’affiche, rien ne s’ouvre', async () => {
    mocks.getPassportPdfUrl.mockRejectedValue(
      new Error('La signature C2PA n’est pas configurée sur le serveur.'),
    );
    setup();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Générer le PDF signé' })).toBeEnabled());
    generate();
    expect(await screen.findByText('PDF indisponible')).toBeInTheDocument();
    expect(screen.getByText('La signature C2PA n’est pas configurée sur le serveur.')).toBeInTheDocument();
    expect(open).not.toHaveBeenCalled();
  });

  it('déjà signé : le bouton propose de régénérer (le Passeport a pu changer depuis)', async () => {
    setup(passport({ c2pa_signed: true }));
    expect(await screen.findByRole('button', { name: 'Générer à nouveau le PDF signé' })).toBeInTheDocument();
  });
});
