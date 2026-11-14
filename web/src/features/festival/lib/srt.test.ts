import { describe, expect, it } from 'vitest';
import type { SubtitleLine } from '@/api/types';
import { allValidated, toSrt } from './srt';

const line = (p: Partial<SubtitleLine>): SubtitleLine => ({
  id: 'a',
  start: '00:00:01,000',
  end: '00:00:02,500',
  source: 'Yezzi',
  fr: 'Ça suffit',
  en: 'Enough',
  confidence: 'elevee',
  validated: true,
  ...p,
});

describe('srt', () => {
  it('produit un fichier SRT numéroté', () => {
    const out = toSrt(
      [line({}), line({ id: 'b', start: '00:00:03,000', end: '00:00:04,000', fr: 'Merci' })],
      'fr',
    );
    expect(out).toBe(
      '1\n00:00:01,000 --> 00:00:02,500\nÇa suffit\n\n2\n00:00:03,000 --> 00:00:04,000\nMerci\n',
    );
    expect(toSrt([line({})], 'en')).toContain('Enough');
  });
  it('n’autorise l’export que si tout est validé', () => {
    expect(allValidated([])).toBe(false);
    expect(allValidated([line({}), line({ validated: false })])).toBe(false);
    expect(allValidated([line({})])).toBe(true);
  });
});
