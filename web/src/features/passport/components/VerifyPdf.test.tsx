import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PdfVerification } from '@/api';
import { TooltipProvider } from '@/components/ui';
import { MAX_PDF_MB, VerifyPdf } from './VerifyPdf';

const mocks = vi.hoisted(() => ({ verifyPassportPdf: vi.fn() }));
vi.mock('@/api', () => ({ api: mocks }));

const ok: PdfVerification = {
  state: 'valid',
  issued_by_us: true,
  signing_mode: 'test',
  badge_code: 'EN-ABCD-23',
  tools: [],
  problems: [],
  matches_passport: true,
  reasons: [],
};

function setup(badge = 'EN-ABCD-23') {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TooltipProvider>
        <VerifyPdf badgeCode={badge} />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}
const pick = (file: File) =>
  fireEvent.change(screen.getByLabelText('Choisir le PDF'), { target: { files: [file] } });
const pdf = (name = 'passeport.pdf') => new File(['%PDF-1.4'], name, { type: 'application/pdf' });

beforeEach(() => vi.clearAllMocks());

describe('déposer un PDF reçu', () => {
  it('dit d’emblée que le fichier est lu puis oublié', () => {
    setup();
    expect(screen.getByText(/lu puis oublié : rien n’est conservé/)).toBeInTheDocument();
  });

  it('un PDF authentique et à jour : verdict positif, avec la limite de ce que prouve la signature', async () => {
    mocks.verifyPassportPdf.mockResolvedValue(ok);
    setup();
    const file = pdf();
    pick(file);
    expect(await screen.findByText('Authentique et à jour')).toBeInTheDocument();
    expect(mocks.verifyPassportPdf).toHaveBeenCalledWith(file);
    expect(screen.getByText(/certificat de test/)).toBeInTheDocument();
    expect(screen.getByText(/pas que les déclarations sont exactes/)).toBeInTheDocument();
  });

  it('un PDF modifié : alerte claire', async () => {
    mocks.verifyPassportPdf.mockResolvedValue({
      ...ok,
      state: 'invalid',
      issued_by_us: false,
      badge_code: undefined,
    });
    setup();
    pick(pdf());
    expect(await screen.findByText('Fichier modifié')).toBeInTheDocument();
  });

  it('un PDF d’un autre Passeport que la page : signalé', async () => {
    mocks.verifyPassportPdf.mockResolvedValue({ ...ok, badge_code: 'EN-ZZZZ-99' });
    setup('EN-ABCD-23');
    pick(pdf());
    expect(await screen.findByText('Ce PDF est celui d’un autre Passeport')).toBeInTheDocument();
  });

  it('erreur du serveur (pas un PDF, limite, démonstration) : le message s’affiche', async () => {
    mocks.verifyPassportPdf.mockRejectedValue(new Error('Ce fichier n’est pas un PDF.'));
    setup();
    pick(pdf('image.pdf'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ce fichier n’est pas un PDF.');
  });

  it('un fichier trop gros n’est même pas envoyé', async () => {
    setup();
    const big = new File(['x'], 'gros.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: (MAX_PDF_MB + 1) * 1024 * 1024 });
    pick(big);
    expect(await screen.findByRole('alert')).toHaveTextContent(`dépasse ${MAX_PDF_MB} Mo`);
    expect(mocks.verifyPassportPdf).not.toHaveBeenCalled();
  });

  it('le résultat précédent disparaît quand on dépose un fichier trop gros', async () => {
    mocks.verifyPassportPdf.mockResolvedValue(ok);
    setup();
    pick(pdf());
    await screen.findByText('Authentique et à jour');
    const big = new File(['x'], 'gros.pdf');
    Object.defineProperty(big, 'size', { value: (MAX_PDF_MB + 1) * 1024 * 1024 });
    pick(big);
    await waitFor(() => expect(screen.queryByText('Authentique et à jour')).toBeNull());
  });
});
