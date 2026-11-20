import type { Location, LocationSuggestInput, Project, Scene } from '@/api/types';

type FilmSource = Pick<Project, 'title' | 'format' | 'city' | 'film_profile' | 'synopsis'>;

/** Contexte du film envoyé à l'IA : titre, format, ville, genre et synopsis court s'ils existent. */
export function filmContext(project: FilmSource): LocationSuggestInput['film'] {
  return {
    title: project.title,
    format: project.format,
    city: project.city,
    ...(project.film_profile?.genre ? { genre: project.film_profile.genre } : {}),
    ...(project.synopsis?.court ? { synopsis: project.synopsis.court } : {}),
  };
}

/** Données envoyées au repérage : contexte du film, scènes de ce décor, noms des autres décors. */
export function buildSuggestInput(
  project: FilmSource,
  location: Pick<Location, 'name'>,
  scenes: Scene[],
  otherDecors: string[],
  exclude: string[],
  constraints: string[] = [],
): LocationSuggestInput {
  return {
    film: filmContext(project),
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
    ...(constraints.length ? { constraints } : {}),
  };
}
