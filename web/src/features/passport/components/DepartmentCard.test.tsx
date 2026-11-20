import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiTool, DepartmentDeclaration } from '@/api';
import { TooltipProvider } from '@/components/ui';
import { DepartmentCard } from './DepartmentCard';

const mocks = vi.hoisted(() => ({
  resolveAiTool: vi.fn(),
  getAiToolRun: vi.fn(),
  getAiTools: vi.fn(),
}));
vi.mock('@/api', () => ({ api: mocks }));

const tool = (id: string, over: Partial<AiTool> = {}): AiTool => ({
  id,
  name: id,
  provider: 'Vendeur',
  status: 'partiel',
  note: 'Note.',
  source_url: 'https://a.example/terms',
  checked_at: '2026-11-19T10:00:00Z',
  reviewed: false,
  ...over,
});

const seen: DepartmentDeclaration[] = [];

function Host({ tools }: { tools: AiTool[] }) {
  const [d, setD] = useState<DepartmentDeclaration | undefined>({
    department: 'scenario',
    used_ai: true,
    what: '',
    human_decisions: '',
  });
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TooltipProvider>
        <DepartmentCard
          department="scenario"
          index={0}
          declaration={d}
          tools={tools}
          onChange={(next) => {
            seen.push(next);
            setD(next);
          }}
        />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

const chooseOther = () =>
  fireEvent.change(screen.getByLabelText(/Quel outil/), { target: { value: '__autre__' } });
const typeName = (v: string) =>
  fireEvent.change(screen.getByLabelText(/Nom de l’outil/), { target: { value: v } });
const search = () => fireEvent.click(screen.getByRole('button', { name: 'Chercher cet outil' }));
const last = () => seen[seen.length - 1];

beforeEach(() => {
  vi.clearAllMocks();
  seen.length = 0;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
});
afterEach(() => vi.useRealTimers());

describe('ajouter un outil absent de la liste', () => {
  it('le bouton attend un vrai nom (2 lettres au moins)', () => {
    render(<Host tools={[tool('claude')]} />);
    chooseOther();
    expect(screen.getByRole('button', { name: 'Chercher cet outil' })).toBeDisabled();
    typeName('P');
    expect(screen.getByRole('button', { name: 'Chercher cet outil' })).toBeDisabled();
    typeName('Pika');
    expect(screen.getByRole('button', { name: 'Chercher cet outil' })).toBeEnabled();
  });

  it('outil déjà au catalogue : il est choisi tout de suite, sans nom libre', async () => {
    mocks.resolveAiTool.mockResolvedValue({ state: 'found', tool: tool('deepl') });
    render(<Host tools={[tool('claude'), tool('deepl')]} />);
    chooseOther();
    typeName('DeepL');
    search();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(mocks.resolveAiTool).toHaveBeenCalledWith('DeepL');
    expect(last()).toMatchObject({ tool_id: 'deepl', custom_tool: undefined });
    expect(screen.getByText('Source du fournisseur')).toBeInTheDocument();
  });

  it('outil absent : recherche sur le serveur, état annoncé, puis fiche choisie', async () => {
    mocks.resolveAiTool.mockResolvedValue({ state: 'researching', run_id: 'r1' });
    mocks.getAiToolRun.mockResolvedValue({ id: 'r1', state: 'done', tool_slug: 'pika' });
    mocks.getAiTools.mockResolvedValue([tool('pika')]);
    render(<Host tools={[tool('pika')]} />);
    chooseOther();
    typeName('Pika');
    search();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(screen.getByRole('status')).toHaveTextContent('Recherche en cours');
    expect(screen.getByRole('button', { name: 'Chercher cet outil' })).toBeDisabled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });
    expect(last()).toMatchObject({ tool_id: 'pika', custom_tool: undefined });
    expect(screen.queryByRole('status')).toBeNull();
    // fiche non relue : la page le dit
    expect(screen.getByText(/Fiche non relue par une personne/)).toBeInTheDocument();
  });

  it('recherche sans résultat : le motif s’affiche et le nom saisi est gardé (« hors catalogue »)', async () => {
    mocks.resolveAiTool.mockResolvedValue({ state: 'researching', run_id: 'r1' });
    mocks.getAiToolRun.mockResolvedValue({
      id: 'r1',
      state: 'failed',
      error: 'Outil non reconnu : aucun site officiel trouvé.',
    });
    render(<Host tools={[tool('claude')]} />);
    chooseOther();
    typeName('Zzzz');
    search();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Outil non reconnu : aucun site officiel trouvé.');
    expect(alert).toHaveTextContent('hors catalogue');
    expect(alert).toHaveTextContent('pas un reproche');
    expect(last()).toMatchObject({ custom_tool: 'Zzzz' });
    expect(last().tool_id).toBeUndefined();
    expect(screen.getByLabelText(/Nom de l’outil/)).toHaveValue('Zzzz');
  });

  it('limite de demandes ou panne : le message du serveur s’affiche', async () => {
    mocks.resolveAiTool.mockRejectedValue(
      new Error('Trop de demandes en peu de temps. Réessaie dans un instant.'),
    );
    render(<Host tools={[]} />);
    chooseOther();
    typeName('Pika');
    search();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Trop de demandes en peu de temps.');
  });

  it('un outil du catalogue reste choisissable directement, avec son statut', () => {
    render(<Host tools={[tool('claude', { status: 'non_evalue' })]} />);
    fireEvent.change(screen.getByLabelText(/Quel outil/), { target: { value: 'claude' } });
    expect(last()).toMatchObject({ tool_id: 'claude' });
    expect(screen.getByText('Non évalué')).toBeInTheDocument();
  });
});
