import { describe, expect, it } from 'vitest';

/**
 * Promesses que nous ne pouvons pas tenir : l'IA de Google (offre gratuite) peut apprendre du texte
 * envoyé, et un PDF signé ne dit rien de l'exactitude des déclarations. Ce test échoue si un texte
 * de l'interface les reformule, pour qu'on y réfléchisse avant de les remettre.
 */
const sources = import.meta.glob('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const FORBIDDEN: { pattern: RegExp; why: string }[] = [
  { pattern: /ne sert (pas )?(à|a) entraîner/i, why: 'promesse de non-entraînement de l’IA' },
  { pattern: /ne servent (pas )?(à|a) entraîner/i, why: 'promesse de non-entraînement de l’IA' },
  { pattern: /ne sert à rien d['’]entraîner/i, why: 'promesse de non-entraînement de l’IA' },
  {
    pattern: /Fichier final (pas encore )?signé/i,
    why: 'on signe le PDF du Passeport, pas un fichier final',
  },
];

describe('textes de l’interface : rien de promis qui ne soit tenu', () => {
  const files = Object.entries(sources).filter(
    ([path]) => !path.includes('.test.') && !path.includes('/api/mocks/'),
  );

  it('lit bien les sources', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  for (const { pattern, why } of FORBIDDEN) {
    it(`aucun texte : ${why}`, () => {
      const hits = files.filter(([, text]) => pattern.test(text)).map(([path]) => path);
      expect(hits).toEqual([]);
    });
  }

  it('la page « Mes données » dit où part le texte des scènes', () => {
    const page = sources['/src/routes/MyData.tsx'];
    expect(page).toContain('Gemini (Google)');
    expect(page).toContain('peut servir à améliorer ses services');
  });
});
