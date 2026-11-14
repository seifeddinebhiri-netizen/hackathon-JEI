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
