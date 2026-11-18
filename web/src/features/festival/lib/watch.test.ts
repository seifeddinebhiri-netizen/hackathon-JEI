import { describe, expect, it } from 'vitest';
import type { SubtitleLine } from '@/api/types';
import { isRisky, lineAt, stopReason, timed, watchStep } from './watch';

const l = (id: string, start: string, end: string, p: Partial<SubtitleLine> = {}): SubtitleLine => ({
  id,
  start: `00:00:${start}`,
  end: `00:00:${end}`,
  source: '…',
  fr: 'Bonjour',
  en: 'Hello',
  confidence: 'elevee',
  validated: false,
  warnings: [],
  ...p,
});

const lines = timed([
  l('l1', '01,000', '02,000'),
  l('l2', '03,000', '04,000'),
  l('l3', '05,000', '06,000', {
    warnings: [{ rule: 'lecture_rapide', detail: 'EN : 31 car./s pour 1,8 s (limite 17)' }],
  }),
  l('l4', '07,000', '08,000'),
  l('l5', '09,000', '10,000', { confidence: 'faible' }),
]);
const none = new Set<string>();

describe('Regarder et valider : arrêt automatique', () => {
  it('repère les lignes à risque (avertissement de règle, confiance faible)', () => {
    expect(isRisky(lines[0].line)).toBe(false);
    expect(stopReason(lines[2].line)).toBe('Trop rapide à lire : EN : 31 car./s pour 1,8 s (limite 17)');
    expect(stopReason(lines[4].line)).toBe('Confiance faible.');
    expect(isRisky(l('x', '00,000', '01,000', { confidence: 'moyenne' }))).toBe(false);
  });

  it('valide les lignes vues en entier sans arrêt', () => {
    const step = watchStep(lines, 0, 4.5, none, none);
    expect(step.validate).toEqual(['l1', 'l2']);
    expect(step.stop).toBeUndefined();
  });

  it('ne valide pas une ligne encore à l’écran', () => {
    expect(watchStep(lines, 0, 1.5, none, none).validate).toEqual([]);
  });

  it('s’arrête au début de la première ligne à risque, même si la lecture l’a dépassée', () => {
    const step = watchStep(lines, 0, 5.3, none, none);
    expect(step.stop).toEqual({ id: 'l3', at: 5, reason: expect.stringContaining('Trop rapide') });
    expect(step.validate).toEqual(['l1', 'l2']);
  });

  it('ne s’arrête pas deux fois sur la même ligne, et ne la valide pas en la laissant passer', () => {
    const step = watchStep(lines, 5, 8.5, none, new Set(['l3']));
    expect(step.stop).toBeUndefined();
    expect(step.validate).toEqual(['l4']);
  });

  it('ne s’arrête pas sur une ligne à risque déjà validée', () => {
    const step = watchStep(lines, 0, 8.5, new Set(['l3']), none);
    expect(step.stop).toBeUndefined();
    expect(step.validate).toEqual(['l1', 'l2', 'l4']);
  });

  it('ignore les lignes avant le début de la lecture continue (saut dans la frise)', () => {
    const step = watchStep(lines, 6.5, 8.5, none, none);
    expect(step.validate).toEqual(['l4']);
    expect(step.stop).toBeUndefined();
    expect(watchStep(lines, 6.5, 9.2, none, none).stop?.id).toBe('l5');
  });

  it('trouve la ligne affichée', () => {
    expect(lineAt(lines, 3.5)).toBe(1);
    expect(lineAt(lines, 4.5)).toBe(-1);
  });
});
