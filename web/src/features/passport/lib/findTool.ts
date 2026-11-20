import { api, type AiTool } from '@/api';

/** La recherche automatique a échoué ou n'a rien trouvé de vérifiable. */
export class ToolSearchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolSearchError';
  }
}

export const POLL_EVERY_MS = 2_000;
export const GIVE_UP_AFTER_MS = 120_000;

type Deps = {
  sleep: (ms: number) => Promise<void>;
  now: () => number;
};
const real: Deps = { sleep: (ms) => new Promise((r) => setTimeout(r, ms)), now: () => Date.now() };

/**
 * « Ajouter cet outil » : le catalogue, sinon une recherche guidée lancée sur le serveur (10 à 60 s),
 * relue toutes les 2 secondes. Renvoie la fiche trouvée ; sinon `ToolSearchError` avec la raison
 * donnée par le serveur. Ne devine jamais : une recherche sans résultat vérifiable échoue.
 */
export async function findTool(name: string, deps: Deps = real): Promise<AiTool> {
  const start = await api.resolveAiTool(name);
  if (start.state === 'found') return start.tool;

  const deadline = deps.now() + GIVE_UP_AFTER_MS;
  while (deps.now() < deadline) {
    await deps.sleep(POLL_EVERY_MS);
    const run = await api.getAiToolRun(start.run_id);
    if (run.state === 'failed') {
      throw new ToolSearchError(run.error || 'La recherche n’a rien trouvé de vérifiable.');
    }
    if (run.state === 'done' && run.tool_slug) {
      const tool = (await api.getAiTools()).find((t) => t.id === run.tool_slug);
      if (tool) return tool;
      throw new ToolSearchError('La fiche a été créée mais n’a pas pu être chargée. Recharge la page.');
    }
  }
  throw new ToolSearchError('La recherche prend trop de temps. Réessaie dans quelques minutes.');
}
