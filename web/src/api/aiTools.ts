import type { CatalogTool } from './schemas';
import type { AiTool } from './types';

const NOTES: Record<CatalogTool['research_state'], string> = {
  none: 'Aucune recherche terminée pour cet outil.',
  incomplete_access:
    'Les pages du fournisseur n’ont pas pu être lues automatiquement : aucune information vérifiée.',
  complete: '',
};

/**
 * Fiche du catalogue (backend ou table `ai_tools`) → `AiTool` de l'interface.
 * L'identifiant d'un outil est son `slug` : c'est lui que les déclarations enregistrent (`tool_id`).
 * Un outil sans statut calculé est « non évalué », jamais « non divulgué » : le second veut dire que
 * le fournisseur ne publie rien, le premier que NOUS n'avons rien pu lire.
 */
export function toAiTool(t: CatalogTool): AiTool {
  return {
    id: t.slug,
    name: t.name,
    provider: t.vendor,
    status: t.status ?? 'non_evalue',
    note: t.note_fr?.trim() || NOTES[t.research_state],
    source_url: t.terms_url ?? t.official_site ?? '',
    checked_at: t.checked_at ?? '',
    reviewed: t.review_state === 'verifie',
  };
}
