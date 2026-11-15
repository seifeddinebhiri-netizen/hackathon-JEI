import type { PlannerDraft } from '../components/wizard/types';
import type { ScoutChoice } from './storage';
import { localTime } from './solar';

export function matchesChoice(scene: PlannerDraft['scenes'][number], choice: ScoutChoice) {
  return (
    scene.number === choice.scene_number &&
    scene.title === choice.scene_heading &&
    (!choice.scene_id.startsWith('project:') || choice.scene_id.endsWith(`:${scene.id}`))
  );
}

export function applyScoutChoice(draft: PlannerDraft, choice: ScoutChoice): PlannerDraft {
  const matching = draft.scenes.find((s) => matchesChoice(s, choice));
  if (!matching) return draft;
  const id = `scout-${choice.location.id}`;
  const note = `Repérage confirmé : ${choice.date}, ${localTime(choice.slot.start, choice.timezone)}–${localTime(choice.slot.end, choice.timezone)} (${choice.timezone}). Préférence à reporter dans le calendrier ; accès et autorisations non vérifiés. Source : ${choice.location.source}.`;
  const existing = draft.locations.find((l) => l.id === id);
  return {
    ...draft,
    locations: [
      ...draft.locations.filter((l) => l.id !== id),
      {
        ...existing,
        id,
        name: choice.location.name,
        address: choice.location.address,
        lat: choice.location.lat,
        lon: choice.location.lon,
        permit: existing?.permit ?? 'a_demander',
        forbidden_days: existing?.forbidden_days ?? [],
        notes: existing?.notes?.includes(note)
          ? existing.notes
          : existing?.notes
            ? `${existing.notes}\n${note}`
            : note,
      },
    ],
    scenes: draft.scenes.map((s) => (s.id === matching.id ? { ...s, location_id: id } : s)),
  };
}
