import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiTool } from '@/api';
import { findTool, GIVE_UP_AFTER_MS, POLL_EVERY_MS, ToolSearchError } from './findTool';

const mocks = vi.hoisted(() => ({
  resolveAiTool: vi.fn(),
  getAiToolRun: vi.fn(),
  getAiTools: vi.fn(),
}));
vi.mock('@/api', () => ({ api: mocks }));

const tool = (id: string): AiTool => ({
  id,
  name: id,
  provider: 'V',
  status: 'partiel',
  note: '',
  source_url: '',
  checked_at: '',
});

/** Horloge simulée : `sleep` fait avancer le temps sans attendre. */
function clock() {
  let t = 0;
  return { now: () => t, sleep: vi.fn(async (ms: number) => void (t += ms)) };
}

beforeEach(() => vi.clearAllMocks());

describe('ajouter un outil absent de la liste', () => {
  it('déjà au catalogue : aucune recherche, aucune attente', async () => {
    mocks.resolveAiTool.mockResolvedValue({ state: 'found', tool: tool('claude') });
    const c = clock();
    expect((await findTool('Claude', c)).id).toBe('claude');
    expect(c.sleep).not.toHaveBeenCalled();
    expect(mocks.getAiToolRun).not.toHaveBeenCalled();
  });

  it('recherche lancée : relue toutes les 2 secondes jusqu’à la fiche', async () => {
    mocks.resolveAiTool.mockResolvedValue({ state: 'researching', run_id: 'r1' });
    mocks.getAiToolRun
      .mockResolvedValueOnce({ id: 'r1', state: 'queued' })
      .mockResolvedValueOnce({ id: 'r1', state: 'running' })
      .mockResolvedValueOnce({ id: 'r1', state: 'done', tool_slug: 'pika' });
    mocks.getAiTools.mockResolvedValue([tool('claude'), tool('pika')]);
    const c = clock();
    expect((await findTool('Pika', c)).id).toBe('pika');
    expect(c.sleep).toHaveBeenCalledTimes(3);
    expect(c.sleep).toHaveBeenCalledWith(POLL_EVERY_MS);
    expect(mocks.getAiToolRun).toHaveBeenCalledWith('r1');
  });

  it('échec côté serveur : le motif donné par le serveur est conservé', async () => {
    mocks.resolveAiTool.mockResolvedValue({ state: 'researching', run_id: 'r1' });
    mocks.getAiToolRun.mockResolvedValue({
      id: 'r1',
      state: 'failed',
      error: 'Outil non reconnu : aucun site officiel trouvé.',
    });
    await expect(findTool('Zzz', clock())).rejects.toThrow('Outil non reconnu : aucun site officiel trouvé.');
    await expect(findTool('Zzz', clock())).rejects.toBeInstanceOf(ToolSearchError);
  });

  it('échec sans motif : message par défaut, jamais vide', async () => {
    mocks.resolveAiTool.mockResolvedValue({ state: 'researching', run_id: 'r1' });
    mocks.getAiToolRun.mockResolvedValue({ id: 'r1', state: 'failed' });
    await expect(findTool('Zzz', clock())).rejects.toThrow(/rien trouvé de vérifiable/);
  });

  it('recherche qui ne finit pas : on abandonne après 2 minutes', async () => {
    mocks.resolveAiTool.mockResolvedValue({ state: 'researching', run_id: 'r1' });
    mocks.getAiToolRun.mockResolvedValue({ id: 'r1', state: 'running' });
    const c = clock();
    await expect(findTool('Lent', c)).rejects.toThrow(/trop de temps/);
    expect(c.sleep.mock.calls.length).toBe(GIVE_UP_AFTER_MS / POLL_EVERY_MS);
  });

  it('fiche créée mais absente de la liste rechargée : erreur claire plutôt qu’un outil inventé', async () => {
    mocks.resolveAiTool.mockResolvedValue({ state: 'researching', run_id: 'r1' });
    mocks.getAiToolRun.mockResolvedValue({ id: 'r1', state: 'done', tool_slug: 'pika' });
    mocks.getAiTools.mockResolvedValue([tool('claude')]);
    await expect(findTool('Pika', clock())).rejects.toThrow(/n’a pas pu être chargée/);
  });

  it('une erreur réseau ou une limite (429) de la demande remonte telle quelle', async () => {
    mocks.resolveAiTool.mockRejectedValue(new Error('Trop de demandes en peu de temps.'));
    await expect(findTool('Pika', clock())).rejects.toThrow('Trop de demandes en peu de temps.');
  });
});
