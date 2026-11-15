import { describe, expect, it } from 'vitest';
import { buildDemoProject } from './mocks/data/project';
import { projectSchema } from './schemas';

describe('projectSchema', () => {
  it('accepte un projet sans les champs du Kit Festival', () => {
    const { film_page: _omit, ...p } = buildDemoProject();
    expect(projectSchema.safeParse(p).success).toBe(true);
  });
  it('valide film_profile, synopsis et film_page', () => {
    const p = {
      ...buildDemoProject(),
      film_profile: { duration_min: 15, language: 'Derja', genre: 'Fiction' },
      synopsis: { phrase: 'a', court: 'b', long: 'c' },
      film_page: { stills: ['/photos/ruelle.jpg'], trailer_url: 'https://exemple.invalid' },
    };
    expect(projectSchema.safeParse(p).success).toBe(true);
    expect(projectSchema.safeParse({ ...p, synopsis: { phrase: 'a' } }).success).toBe(false);
  });
});

describe('scènes et lieux proposés', () => {
  it('accepte l’extrait de scène (1 200 caractères au plus)', async () => {
    const { sceneSchema } = await import('./schemas');
    const scene = { ...buildDemoProject().scenes[0], excerpt: 'INT. CAFÉ — JOUR' };
    expect(sceneSchema.safeParse(scene).success).toBe(true);
    expect(sceneSchema.safeParse({ ...scene, excerpt: 'x'.repeat(1201) }).success).toBe(false);
  });

  it('valide une réponse de POST /planner/locations/suggest', async () => {
    const { locationSuggestResultSchema } = await import('./schemas');
    const { mockSuggestLocations } = await import('./mocks/locationSuggest');
    const r = mockSuggestLocations({
      film: { title: 'Marée basse', format: 'court', city: 'Tunis' },
      decor: { name: 'Petit café de Tunis' },
      scenes: [],
      other_decors: [],
      exclude: [],
    });
    expect(locationSuggestResultSchema.safeParse(r).success).toBe(true);
    expect(locationSuggestResultSchema.safeParse({ ...r, status: 'Validé' }).success).toBe(false);
  });
});
