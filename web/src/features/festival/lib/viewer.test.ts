import { describe, expect, it } from 'vitest';
import type { SubtitleLine } from '@/api/types';
import {
  checkSummary,
  initialFilter,
  mergeLine,
  needsCheck,
  nextIndex,
  previousIndex,
  segmentState,
  subtitleText,
  toolName,
  visibleIndexes,
} from './viewer';

const line = (id: string, patch: Partial<SubtitleLine> = {}): SubtitleLine => ({
  id,
  start: '00:00:01,000',
  end: '00:00:03,000',
  source: 'Labes',
  fr: 'Ça va ?',
  en: 'You okay?',
  confidence: 'elevee',
  validated: false,
  ...patch,
});
const lines = [
  line('l1'),
  line('l2', { confidence: 'faible' }),
  line('l3'),
  line('l4', { warnings: [{ rule: 'omission_possible', detail: 'FR : 2 phrases pour 3' }] }),
];

describe('écran de relecture : logique pure', () => {
  it('le texte incrusté suit la modification en cours, dans la langue choisie', () => {
    expect(subtitleText(lines[0], 'en')).toBe('You okay?');
    expect(subtitleText(lines[0], 'fr', { l1: { fr: ' Ça roule ? ' } })).toBe('Ça roule ?');
    expect(subtitleText(lines[0], 'en', { l1: { fr: 'x' } })).toBe('You okay?');
    expect(subtitleText(line('l9', { en: undefined }), 'en')).toBe('');
  });

  it('applique les modifications et les validations à la ligne affichée', () => {
    const m = mergeLine(
      line('l1', { fr_court: 'Ça va ?' }),
      { l1: { fr: 'Ça va.', fr_court: undefined } },
      new Set(['l1']),
    );
    expect(m.fr).toBe('Ça va.');
    expect(m.fr_court).toBeUndefined();
    expect(m.validated).toBe(true);
  });

  it('état des segments de la frise : en cours, validée, à vérifier', () => {
    const v = new Set(['l1']);
    expect(segmentState(lines[0], 0, 2, v)).toBe('validee');
    expect(segmentState(lines[2], 2, 2, v)).toBe('en_cours');
    expect(segmentState(lines[1], 1, 2, v)).toBe('a_verifier');
  });

  it('filtre « À vérifier d’abord » : lignes à risque encore à valider, dans l’ordre du film', () => {
    const none = new Set<string>();
    expect(visibleIndexes(lines, 'risque', none)).toEqual([1, 3]);
    expect(visibleIndexes(lines, 'risque', new Set(['l2']))).toEqual([3]);
    expect(visibleIndexes(lines, 'toutes', none)).toEqual([0, 1, 2, 3]);
    expect(needsCheck(lines[3], none)).toBe(true);
    expect(needsCheck(lines[3], new Set(['l4']))).toBe(false);
  });

  it('navigation dans la liste filtrée', () => {
    expect(nextIndex([1, 3], 1)).toBe(3);
    expect(nextIndex([1, 3], 3)).toBeNull();
    expect(previousIndex([1, 3], 3)).toBe(1);
    expect(previousIndex([1, 3], 1)).toBeNull();
  });

  it('filtre de départ et nom des outils lus dans processing', () => {
    expect(initialFilter(lines)).toBe('risque');
    expect(initialFilter([line('l1')])).toBe('toutes');
    expect(toolName('elevenlabs/scribe_v2')).toBe('scribe v2');
    expect(toolName('gemini/gemini-3.1-flash-lite')).toBe('gemini-3.1-flash-lite');
  });

  it('résumé « à vérifier » sans répéter les avertissements', () => {
    expect(checkSummary(lines[1])).toBe('confiance faible');
    expect(checkSummary(lines[3])).toBe('1 avertissement ci-dessous');
    expect(checkSummary(lines[0])).toBeNull();
  });
});
