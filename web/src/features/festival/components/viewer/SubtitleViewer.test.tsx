import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { SubtitleDraft, SubtitleLine } from '@/api/types';
import { buildDemoProject } from '@/api/mocks/data/project';
import { Toaster } from '@/components/ui';
import { VideoSessionContext } from '../../video/videoSession';
import { SubtitleViewer } from './SubtitleViewer';

const mutate = vi.fn();
vi.mock('../../hooks/useFestivals', async (orig) => ({
  ...(await orig<typeof import('../../hooks/useFestivals')>()),
  useSaveSubtitles: () => ({ mutate, isPending: false }),
}));

const base = { source: 'Labes', confidence: 'elevee', validated: false } as const;
const lines: SubtitleLine[] = [
  { ...base, id: 'l1', start: '00:00:01,000', end: '00:00:03,000', fr: 'Bonjour.', en: 'Hello.' },
  {
    ...base,
    id: 'l2',
    start: '00:00:04,000',
    end: '00:00:05,000',
    fr: 'Je m’appelle Tarek et je suis diplômé de l’école de cinéma.',
    en: 'My name is Tarek.',
    confidence: 'faible',
    note: 'mot incertain : خراج',
    fr_court: 'Je suis Tarek, diplômé.',
    warnings: [{ rule: 'lecture_rapide', detail: 'FR : 59 car./s pour 1,0 s (limite 17)' }],
  },
  { ...base, id: 'l3', start: '00:00:06,000', end: '00:00:08,000', fr: 'Au revoir.', en: 'Bye.' },
];
const draft: SubtitleDraft = {
  project_id: 'demo-maree-basse',
  source_lang: 'derja',
  lines,
  processing: {
    transcriber: 'elevenlabs/scribe_v2',
    translator: 'gemini/gemini-3.1-flash-lite',
    created_at: '2026-11-18T00:00:00Z',
  },
};

function renderViewer(search = '') {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/festival/sous-titres${search}`]}>
        <Toaster>
          <VideoSessionContext.Provider value={{ file: null, url: null, setFile: vi.fn() }}>
            <SubtitleViewer project={buildDemoProject()} draft={draft} />
          </VideoSessionContext.Provider>
        </Toaster>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('écran unique de relecture (sans vidéo)', () => {
  it('commence sur la ligne à risque et montre tout ce que la liste affichait', () => {
    renderViewer('?langue=fr');
    const panel = screen.getByRole('complementary', { name: 'Ligne en cours' });
    expect(within(panel).getByText('mot incertain : خراج')).toBeInTheDocument();
    expect(within(panel).getByText(/59 car\.\/s/)).toBeInTheDocument();
    expect(within(panel).getByText(/Version courte proposée/)).toBeInTheDocument();
    expect(screen.getByTestId('sous-titre-incruste')).toHaveTextContent('Je m’appelle Tarek');
    expect(screen.getByText('Choisir ma vidéo')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Revoir/ })).not.toBeInTheDocument();
  });

  it('le sous-titre incrusté suit la frappe, et la version courte ne s’applique qu’avec « Utiliser »', () => {
    renderViewer('?langue=fr');
    const fr = screen.getByRole('textbox', { name: 'Français' });
    fireEvent.change(fr, { target: { value: 'Je suis Tarek.' } });
    expect(screen.getByTestId('sous-titre-incruste')).toHaveTextContent('Je suis Tarek.');
    fireEvent.click(screen.getByRole('button', { name: 'Utiliser la version courte en français' }));
    expect(screen.getByRole('textbox', { name: 'Français' })).toHaveValue('Je suis Tarek, diplômé.');
    expect(screen.queryByText(/Version courte proposée/)).not.toBeInTheDocument();
  });

  it('Entrée valide la ligne et passe à la suivante ; la frise suit', () => {
    renderViewer('?langue=en');
    expect(screen.getByText('0 / 3 lignes validées')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.getByText('1 / 3 lignes validées')).toBeInTheDocument();
    // Plus de ligne à risque : on relit le reste dans l’ordre du film, en partant de la 1re non validée
    expect(screen.getByTestId('sous-titre-incruste')).toHaveTextContent('Hello.');
    expect(screen.getByRole('button', { name: /Toutes \(3\)/ })).toHaveAttribute('aria-pressed', 'true');
    const current = screen.getByRole('button', { name: /Ligne 1 · .* · en cours/ });
    expect(current).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: /Ligne 2 · .* · validée/ })).toBeInTheDocument();
  });

  it('« Ce que l’IA a fait » lit processing (plus de nom de modèle en dur)', () => {
    renderViewer();
    expect(screen.getByText(/avec gemini-3\.1-flash-lite/)).toBeInTheDocument();
    expect(screen.getByText(/elevenlabs \(scribe v2\)/)).toBeInTheDocument();
  });
});
