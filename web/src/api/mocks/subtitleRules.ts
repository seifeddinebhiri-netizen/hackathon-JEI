/**
 * Port des règles de sous-titrage du backend (backend/app/services/subtitle_rules.py, fonction `check`) :
 * le mock renvoie les mêmes avertissements que le serveur, sans changer les horodatages.
 */
import { srtToSeconds } from '@/features/festival/lib/srt';
import type * as T from '../types';

const MAX_CHARS_PER_LINE = 42;
const MAX_LINES = 2;
const MAX_CPS = 17;
const MIN_DURATION_S = 1;
const MAX_DURATION_S = 7;
const MIN_GAP_S = 0.08;
const RULES = new Set<T.SubtitleRule>([
  'lecture_rapide',
  'trop_de_lignes',
  'ligne_trop_longue',
  'duree_courte',
  'duree_longue',
  'chevauchement',
]);

const frNum = (x: number) => x.toFixed(1).replace('.', ',');

/** Retour à la ligne glouton, sans couper un mot. */
export function wrap(text: string, width = MAX_CHARS_PER_LINE): string[] {
  const out: string[] = [];
  let current = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && candidate.length > width) {
      out.push(current);
      current = word;
    } else current = candidate;
  }
  if (current) out.push(current);
  return out;
}

function textWarnings(label: string, raw: string, duration: number): T.SubtitleWarning[] {
  const out: T.SubtitleWarning[] = [];
  const text = raw.split(/\s+/).filter(Boolean).join(' ');
  if (!text) return out;
  const wrapped = wrap(text);
  if (wrapped.length > MAX_LINES)
    out.push({
      rule: 'trop_de_lignes',
      detail: `${label} : ${wrapped.length} lignes de ${MAX_CHARS_PER_LINE} car. (limite ${MAX_LINES})`,
    });
  const longest = Math.max(...wrapped.map((w) => w.length));
  if (longest > MAX_CHARS_PER_LINE)
    out.push({
      rule: 'ligne_trop_longue',
      detail: `${label} : un mot de ${longest} car. dépasse la ligne (limite ${MAX_CHARS_PER_LINE})`,
    });
  if (duration > 0) {
    const cps = text.length / duration;
    if (cps > MAX_CPS)
      out.push({
        rule: 'lecture_rapide',
        detail: `${label} : ${Math.round(cps)} car./s pour ${frNum(duration)} s (limite ${MAX_CPS})`,
      });
  }
  return out;
}

export function checkRules(lines: T.SubtitleLine[]): T.SubtitleLine[] {
  let prevEnd: number | null = null;
  return lines.map((line) => {
    const start = srtToSeconds(line.start);
    const end = srtToSeconds(line.end);
    const duration = end - start;
    const warnings = (line.warnings ?? []).filter((w) => !RULES.has(w.rule));
    if (prevEnd !== null && start < prevEnd + MIN_GAP_S)
      warnings.push({
        rule: 'chevauchement',
        detail: `Écart de ${Math.round((start - prevEnd) * 1000)} ms avec la ligne précédente (minimum ${Math.round(MIN_GAP_S * 1000)} ms)`,
      });
    if (duration < MIN_DURATION_S)
      warnings.push({
        rule: 'duree_courte',
        detail: `${frNum(duration)} s à l'écran (minimum ${frNum(MIN_DURATION_S)} s)`,
      });
    else if (duration > MAX_DURATION_S)
      warnings.push({
        rule: 'duree_longue',
        detail: `${frNum(duration)} s à l'écran (maximum ${frNum(MAX_DURATION_S)} s)`,
      });
    warnings.push(...textWarnings('FR', line.fr, duration), ...textWarnings('EN', line.en ?? '', duration));
    prevEnd = end;
    return { ...line, warnings, glossary_used: line.glossary_used ?? [] };
  });
}
