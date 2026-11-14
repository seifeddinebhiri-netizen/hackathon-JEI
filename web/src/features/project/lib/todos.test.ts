import { describe, expect, it } from 'vitest';
import { buildDemoProject } from '@/api/mocks/data/project';
import { projectTodos } from './todos';

describe('projectTodos', () => {
  it('liste les actions utiles du projet de démo', () => {
    const ids = projectTodos(buildDemoProject(), null).map((t) => t.id);
    expect(ids).toContain('permis-loc-medina');
    expect(ids).toContain('planning');
    expect(ids).toContain('passeport');
    expect(ids).not.toContain('relire');
  });
  it('demande d’ajouter des scènes pour un projet vide', () => {
    const p = { ...buildDemoProject(), scenes: [], locations: [], people: [] };
    expect(projectTodos(p, null)[0].id).toBe('scenes');
  });
});
