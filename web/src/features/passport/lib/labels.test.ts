import { describe, expect, it } from 'vitest';
import type { DepartmentDeclaration } from '@/api/types';
import { badgeSvg } from './badge';
import { declarationState, summarize } from './labels';

const d = (p: Partial<DepartmentDeclaration>): DepartmentDeclaration => ({
  department: 'scenario',
  used_ai: false,
  what: '',
  human_decisions: '',
  ...p,
});

describe('Étiquette IA', () => {
  it('compte humain / assisté / généré / non renseigné', () => {
    const c = summarize([
      d({ department: 'scenario' }),
      d({ department: 'montage', used_ai: true, level: 'assistance' }),
      d({ department: 'musique', used_ai: true, level: 'generation_complete' }),
    ]);
    expect(c).toEqual({ humain: 1, assiste: 1, genere: 1, non_renseigne: 5 });
  });

  it('une déclaration IA est complète avec outil, description et niveau', () => {
    expect(declarationState(undefined)).toBe('vide');
    expect(declarationState(d({ used_ai: true }))).toBe('ia_incomplet');
    expect(declarationState(d({ used_ai: true, custom_tool: 'X', what: 'a', level: 'assistance' }))).toBe(
      'ia_complet',
    );
  });

  it('échappe le contenu du badge', () => {
    expect(badgeSvg({ code: '<b>', verifyHost: 'a&b' })).toContain('&lt;b>');
  });
});
