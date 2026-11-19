import { describe, expect, it } from 'vitest';
import { buildDemoProject } from './mocks/data/project';
import { parseScreenplayResultSchema, projectSchema } from './schemas';

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

describe('parseScreenplayResultSchema', () => {
  it('accepte la réponse de POST /planner/parse (null, champs en plus, ai_used)', () => {
    const r = parseScreenplayResultSchema.parse({
      scenes: [
        {
          id: 'sc-1',
          number: '1',
          title: 'Amira attend Slim au quai',
          setting: 'EXT',
          moment: 'aube',
          location_id: 'loc-1',
          characters: ['Amira', 'Slim'],
          estimated_hours: 1.5,
          summary: 'Amira attend.',
          excerpt: 'À l’aube, Amira attend sur le quai.',
          source: 'import_ia',
          validated: false,
          heading: '',
          room: null,
          page_eighths: 2,
        },
      ],
      locations: [
        {
          id: 'loc-1',
          name: 'Quai du port',
          address: '',
          forbidden_days: [],
          permit: 'non_necessaire',
          notes: null,
          kind_fr: 'port',
          brief_fr: null,
        },
      ],
      characters: ['Amira', 'Slim'],
      warnings: [],
      ai_used: true,
    });
    expect(r.locations[0].notes).toBeUndefined();
    expect(r.ai_used).toBe(true);
    expect(r.scenes[0].excerpt).toContain('Amira');
  });
});
