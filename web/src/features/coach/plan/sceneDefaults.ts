import type { Location, Scene, ShotSpecRequest } from '@/api/types';

/** Reprend une scène du planning comme point de départ du formulaire (l'utilisateur peut l'enrichir). */
export function sceneToRequest(scene: Scene, location: Location | undefined): ShotSpecRequest {
  return {
    description: [scene.title, scene.summary].filter(Boolean).join(' : '),
    scene_id: scene.id,
    setting: scene.setting,
    moment:
      scene.moment === 'jour' ||
      scene.moment === 'nuit' ||
      scene.moment === 'aube' ||
      scene.moment === 'heure_doree'
        ? scene.moment
        : undefined,
    location: location?.name,
    characters: scene.characters.slice(0, 8),
  };
}
