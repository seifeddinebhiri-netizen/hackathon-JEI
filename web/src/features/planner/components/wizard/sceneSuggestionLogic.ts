/**
 * Suggestions de tournage sur le scénario : entrée envoyée à l'IA, libellés, et application d'une
 * suggestion ACCEPTÉE par l'auteur au brouillon. Fonctions pures.
 */
import type { SceneSuggestInput, SceneSuggestion } from '@/api/types';
import { MOMENT_TAGS, SETTING_LABELS } from '../../lib/labels';
import { filmContext } from './locationSuggestInput';
import type { PlannerDraft } from './types';

export const SUGGESTION_KIND_LABELS: Record<SceneSuggestion['kind'], string> = {
  preciser_int_ext: 'Intérieur ou extérieur',
  preciser_moment: 'Moment de la journée',
  regrouper_decors: 'Regrouper deux décors',
  alleger_scene: 'Simplifier le tournage',
  info_manquante: 'Information manquante',
};

export function buildSceneSuggestInput(
  project: Parameters<typeof filmContext>[0],
  draft: Pick<PlannerDraft, 'scenes' | 'locations'>,
): SceneSuggestInput {
  const decorOf = new Map(draft.locations.map((l) => [l.id, l.name]));
  return {
    film: filmContext(project),
    scenes: draft.scenes.map((s) => ({
      number: s.number,
      title: s.title,
      setting: s.setting,
      moment: s.moment,
      decor: decorOf.get(s.location_id) ?? '',
      summary: s.summary,
      characters: s.characters,
      estimated_hours: s.estimated_hours,
      ...(s.excerpt ? { excerpt: s.excerpt.slice(0, 1200) } : {}),
    })),
    decors: draft.locations.map((l) => l.name).filter((n) => n.trim()),
  };
}

const sceneList = (numbers: string[]) => `${numbers.length > 1 ? 'Scènes' : 'Scène'} ${numbers.join(', ')}`;

/** Le changement proposé, en clair (« Scène 2 → Extérieur »), ou null si la suggestion ne modifie rien. */
export function describeChange(s: SceneSuggestion): string | null {
  if (s.change_setting) return `${sceneList(s.scene_numbers)} → ${SETTING_LABELS[s.change_setting]}`;
  if (s.change_moment) return `${sceneList(s.scene_numbers)} → ${MOMENT_TAGS[s.change_moment]}`;
  if (s.change_decor) return `${sceneList(s.scene_numbers)} → décor « ${s.change_decor} »`;
  return null;
}

/** Pourquoi une suggestion ne peut plus s'appliquer (scène ou décor supprimés depuis), sinon null. */
export function cannotApply(
  s: SceneSuggestion,
  draft: Pick<PlannerDraft, 'scenes' | 'locations'>,
): string | null {
  const numbers = new Set(draft.scenes.map((x) => x.number));
  if (!s.scene_numbers.some((n) => numbers.has(n))) return 'Cette scène n’existe plus.';
  if (
    s.change_decor &&
    !draft.locations.some((l) => l.name.trim().toLowerCase() === s.change_decor!.trim().toLowerCase())
  )
    return `Le décor « ${s.change_decor} » n’existe plus.`;
  return null;
}

/** Applique une suggestion acceptée : INT/EXT, moment ou décor des scènes concernées. */
export function applySuggestion<D extends Pick<PlannerDraft, 'scenes' | 'locations'>>(
  draft: D,
  s: SceneSuggestion,
): D {
  const target = s.change_decor
    ? draft.locations.find((l) => l.name.trim().toLowerCase() === s.change_decor!.trim().toLowerCase())
    : undefined;
  if (s.change_decor && !target) return draft;
  if (!s.change_setting && !s.change_moment && !target) return draft;
  const concerned = new Set(s.scene_numbers);
  return {
    ...draft,
    scenes: draft.scenes.map((x) =>
      concerned.has(x.number)
        ? {
            ...x,
            ...(s.change_setting ? { setting: s.change_setting } : {}),
            ...(s.change_moment ? { moment: s.change_moment } : {}),
            ...(target ? { location_id: target.id } : {}),
          }
        : x,
    ),
  };
}
