import type { Location, LocationSuggestInput, Project, Scene } from '@/api/types';

/** Données envoyées au repérage : contexte du film, scènes de ce décor, noms des autres décors. */
export function buildSuggestInput(
  project: Pick<Project, 'title' | 'format' | 'city' | 'film_profile' | 'synopsis'>,
  location: Pick<Location, 'name'>,
  scenes: Scene[],
  otherDecors: string[],
  exclude: string[],
): LocationSuggestInput {
  return {
    film: {
      title: project.title,
      format: project.format,
      city: project.city,
      ...(project.film_profile?.genre ? { genre: project.film_profile.genre } : {}),
      ...(project.synopsis?.court ? { synopsis: project.synopsis.court } : {}),
    },
    decor: { name: location.name.trim() },
    scenes: scenes.map((s) => ({
      number: s.number,
      title: s.title,
      setting: s.setting,
      moment: s.moment,
      summary: s.summary,
      characters: s.characters,
      ...(s.excerpt ? { excerpt: s.excerpt.slice(0, 1200) } : {}),
    })),
    other_decors: otherDecors.filter((d) => d.trim()),
    exclude,
  };
}
