import { describe, expect, it } from 'vitest';
import { checkRules } from './subtitleRules';
import type { SubtitleLine } from '../types';

const line = (source: string, fr: string): SubtitleLine => ({
  id: 'l1',
  start: '00:00:00,000',
  end: '00:00:04,000',
  source,
  fr,
  en: fr,
  confidence: 'elevee',
  validated: false,
});
const omissions = (l: SubtitleLine) =>
  (checkRules([l])[0].warnings ?? []).filter((w) => w.rule === 'omission_possible');

describe('omission possible (même règle que le backend)', () => {
  const source = 'اللي أنت تمشي في بحر ما تعرفوش. تمشي في ثنية ما تعرفهاش. ما تمش توصلك.';

  it('signale une fin de ligne non traduite (moins de phrases que la source)', () => {
    const w = omissions(
      line(source, 'Tu navigues dans une mer inconnue. Tu suis un chemin que tu ne connais pas.'),
    );
    expect(w).toHaveLength(2);
    expect(w[0].detail).toContain('2 phrases pour 3');
  });

  it('signale une traduction bien plus courte que la source', () => {
    expect(omissions(line(source, 'Tu navigues.'))[0].detail).toContain('car. pour environ');
  });

  it('ne dit rien pour une traduction complète ou une ligne vide', () => {
    expect(
      omissions(
        line(source, 'Tu navigues dans une mer inconnue. Tu suis un chemin inconnu. Tu n’arrives pas.'),
      ),
    ).toEqual([]);
    expect(omissions(line(source, ''))).toEqual([]);
  });
});
