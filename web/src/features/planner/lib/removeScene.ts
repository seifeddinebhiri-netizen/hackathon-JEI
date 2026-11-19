/**
 * Suppression d'une scène, avec ses lieux devenus inutiles, et annulation.
 * Un lieu encore utilisé par une autre scène est gardé. Un lieu sans scène depuis le début
 * (ajouté à la main à l'étape Lieux) n'est pas touché : seul celui de la scène supprimée compte.
 */
import type { Location, Schedule, Scene } from '@/api/types';

type Draft = { scenes: Scene[]; locations: Location[] };

export type SceneRemoval = {
  scene: Scene;
  sceneIndex: number;
  /** Lieux retirés avec la scène, et leur place d'origine dans la liste. */
  locations: { location: Location; index: number }[];
};

export function removeScene<D extends Draft>(
  draft: D,
  sceneId: string,
): { draft: D; removal: SceneRemoval | null } {
  const sceneIndex = draft.scenes.findIndex((s) => s.id === sceneId);
  if (sceneIndex < 0) return { draft, removal: null };
  const scene = draft.scenes[sceneIndex];
  const scenes = draft.scenes.filter((s) => s.id !== sceneId);
  const stillUsed = new Set(scenes.map((s) => s.location_id));
  const orphan = scene.location_id && !stillUsed.has(scene.location_id) ? scene.location_id : null;
  const locations: SceneRemoval['locations'] = [];
  draft.locations.forEach((location, index) => {
    if (location.id === orphan) locations.push({ location, index });
  });
  return {
    draft: { ...draft, scenes, locations: draft.locations.filter((l) => l.id !== orphan) },
    removal: { scene, sceneIndex, locations },
  };
}

/** Remet la scène et ses lieux à leur place. */
export function restoreScene<D extends Draft>(draft: D, removal: SceneRemoval): D {
  if (draft.scenes.some((s) => s.id === removal.scene.id)) return draft;
  const scenes = [...draft.scenes];
  scenes.splice(Math.min(removal.sceneIndex, scenes.length), 0, removal.scene);
  const locations = [...draft.locations];
  for (const { location, index } of removal.locations) {
    if (!locations.some((l) => l.id === location.id))
      locations.splice(Math.min(index, locations.length), 0, location);
  }
  return { ...draft, scenes, locations };
}

/**
 * Planning sans la scène ni les lieux retirés : créneaux, jours devenus vides et rappels
 * (autorisation, lumière) qui en découlent disparaissent avec eux.
 */
export function pruneSchedule(schedule: Schedule, removal: SceneRemoval): Schedule {
  const sceneId = removal.scene.id;
  const goneLocations = new Set(removal.locations.map((l) => l.location.id));
  const days = schedule.days
    .map((d) => ({
      ...d,
      scenes: d.scenes.filter((s) => s.scene_id !== sceneId),
      location_ids: d.location_ids.filter((id) => !goneLocations.has(id)),
    }))
    .filter((d) => d.scenes.length > 0);
  return { ...schedule, days, unplaced: schedule.unplaced.filter((u) => u.scene_id !== sceneId) };
}

/** La scène fait-elle partie du planning ? (sinon pas besoin de le toucher) */
export function scheduleHasScene(schedule: Schedule | undefined, sceneId: string): boolean {
  return (
    !!schedule &&
    (schedule.days.some((d) => d.scenes.some((s) => s.scene_id === sceneId)) ||
      schedule.unplaced.some((u) => u.scene_id === sceneId))
  );
}
