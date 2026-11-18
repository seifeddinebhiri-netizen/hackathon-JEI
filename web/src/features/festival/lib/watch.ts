/**
 * Mode « Regarder et valider » : logique pure, testée sans navigateur.
 * - une ligne vue en entier pendant une lecture continue est validée ;
 * - la lecture s'arrête au début d'une ligne à risque (confiance faible ou avertissement de règle),
 *   tant qu'elle n'est ni validée ni déjà signalée pendant cette séance.
 */
import type { SubtitleLine } from '@/api/types';
import { RULE_LABELS } from './labels';
import { srtToSeconds } from './srt';

/** Marge pour les arrondis de `currentTime` (secondes). */
export const EPSILON = 0.05;

/** Pourquoi la lecture s'arrête sur cette ligne (null : pas d'arrêt). */
export function stopReason(line: SubtitleLine): string | null {
  const w = line.warnings?.[0];
  if (w) return `${RULE_LABELS[w.rule]} : ${w.detail}`;
  if (line.confidence === 'faible')
    return line.note ? 'Confiance faible : vérifie le sens.' : 'Confiance faible.';
  return null;
}

/** Ordre de relecture : plus le score est haut, plus la ligne est à vérifier en premier. */
export function riskScore(l: SubtitleLine): number {
  const conf = { elevee: 0, moyenne: 1, faible: 2 }[l.confidence];
  return conf + (l.warnings?.length ? 2 : 0);
}

export function isRisky(line: SubtitleLine): boolean {
  return stopReason(line) !== null;
}

export type TimedLine = { line: SubtitleLine; start: number; end: number };

export function timed(lines: SubtitleLine[]): TimedLine[] {
  return lines.map((line) => ({ line, start: srtToSeconds(line.start), end: srtToSeconds(line.end) }));
}

/** Ligne affichée à cet instant (index), ou -1 entre deux lignes. */
export function lineAt(lines: TimedLine[], t: number): number {
  return lines.findIndex((l) => t >= l.start - EPSILON && t < l.end);
}

/** Dernière ligne commencée à cet instant (pour la frise et les flèches), 0 avant la première. */
export function lineIndexAt(lines: TimedLine[], t: number): number {
  let idx = 0;
  lines.forEach((l, i) => {
    if (t >= l.start - EPSILON) idx = i;
  });
  return idx;
}

export type WatchStep = {
  /** Lignes à valider (vues en entier sans arrêt). */
  validate: string[];
  /** Arrêt à faire : ligne à risque et instant où mettre la vidéo en pause. */
  stop?: { id: string; at: number; reason: string };
};

/**
 * Lecture continue de `segmentStart` à `now`.
 * `validated` : lignes déjà validées ; `acknowledged` : arrêts déjà faits pendant cette séance
 * (la lecture ne s'arrête pas deux fois sur la même ligne).
 */
export function watchStep(
  lines: TimedLine[],
  segmentStart: number,
  now: number,
  validated: ReadonlySet<string>,
  acknowledged: ReadonlySet<string>,
): WatchStep {
  const inSegment = (l: TimedLine) => l.start >= segmentStart - EPSILON;
  const stopLine = lines.find(
    (l) =>
      inSegment(l) &&
      l.start <= now + EPSILON &&
      !validated.has(l.line.id) &&
      !acknowledged.has(l.line.id) &&
      isRisky(l.line),
  );
  const until = stopLine ? stopLine.start : now;
  const validate = lines
    .filter((l) => inSegment(l) && l.end <= until + EPSILON && !validated.has(l.line.id) && !isRisky(l.line))
    .map((l) => l.line.id);
  return stopLine
    ? { validate, stop: { id: stopLine.line.id, at: stopLine.start, reason: stopReason(stopLine.line)! } }
    : { validate };
}
