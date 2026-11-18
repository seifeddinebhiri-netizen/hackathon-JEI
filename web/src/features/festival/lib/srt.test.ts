import { describe, expect, it } from 'vitest';
import type { SubtitleLine } from '@/api/types';
import { allValidated, exportBlocker, secondsToSrt, srtBlob, srtFileName, srtToSeconds, toSrt } from './srt';

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

  it('convertit les horodatages', () => {
    expect(srtToSeconds('00:02:44,000')).toBe(164);
    expect(srtToSeconds('01:00:00,250')).toBe(3600.25);
    expect(srtToSeconds('pas une heure')).toBeNaN();
    expect(secondsToSrt(164.4)).toBe('00:02:44,400');
  });
});

describe('export .srt', () => {
  it('nomme le fichier DarHmeti_EN.srt', () => {
    expect(srtFileName('Dar Hmeti', 'en')).toBe('DarHmeti_EN.srt');
    expect(srtFileName('Marée basse', 'fr')).toBe('MareeBasse_FR.srt');
    expect(srtFileName('', 'en')).toBe('SousTitres_EN.srt');
  });

  it('génère un fichier UTF-8 (accents et apostrophes intacts)', async () => {
    const blob = srtBlob([line({ fr: 'Je n’ai plus le cœur à continuer' })], 'fr');
    expect(blob.type).toContain('charset=utf-8');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(new TextDecoder('utf-8', { fatal: true }).decode(bytes)).toContain(
      'Je n’ai plus le cœur à continuer',
    );
    // « œ » tient sur 2 octets en UTF-8
    expect(bytes.length).toBeGreaterThan(
      toSrt([line({ fr: 'Je n’ai plus le cœur à continuer' })], 'fr').length,
    );
  });
});

describe('blocage de l’export', () => {
  it('bloque tant qu’une ligne n’est pas validée', () => {
    const lines = [line({}), line({ id: 'b', validated: false }), line({ id: 'c', validated: false })];
    expect(exportBlocker(lines, 'en')).toBe(
      'Export possible quand les 3 lignes sont validées (2 à valider).',
    );
    expect(() => srtBlob(lines, 'en')).toThrow(/Export possible/);
  });

  it('bloque une ligne validée mais sans texte dans la langue du fichier', () => {
    const lines = [line({}), line({ id: 'b', en: '' })];
    expect(exportBlocker(lines, 'en')).toBe('1 ligne n’a pas de texte anglais.');
    expect(exportBlocker(lines, 'fr')).toBeNull();
  });

  it('bloque une liste vide, débloque quand tout est validé', () => {
    expect(exportBlocker([], 'en')).toBe('Aucune ligne à exporter.');
    expect(exportBlocker([line({}), line({ id: 'b' })], 'en')).toBeNull();
  });
});
