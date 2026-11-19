/**
 * Écran de relecture des sous-titres : logique pure, testée sans navigateur.
 * Les modifications en cours (`LineEdits`) passent avant la ligne enregistrée, pour que le
 * sous-titre affiché sur l'image suive la frappe.
 */
import type { SubtitleLine } from '@/api/types';
import type { SrtLang } from './srt';
import { isRisky } from './watch';

/** Champs modifiables d'une ligne ; `undefined` sur fr_court / en_court = suggestion écartée. */
export type LineEdit = Partial<Pick<SubtitleLine, 'fr' | 'en' | 'fr_court' | 'en_court'>>;
export type LineEdits = Record<string, LineEdit>;

export type ViewerFilter = 'risque' | 'toutes';
export type SegmentState = 'en_cours' | 'validee' | 'a_verifier';

/** Ligne telle qu'affichée : modifications en cours et état de validation appliqués. */
export function mergeLine(
  line: SubtitleLine,
  edits: LineEdits,
  validated: ReadonlySet<string>,
): SubtitleLine {
  return { ...line, ...edits[line.id], validated: validated.has(line.id) };
}

/** Texte du sous-titre dans la langue choisie (vide si la ligne n'a pas encore ce texte). */
export function subtitleText(line: SubtitleLine, lang: SrtLang, edits: LineEdits = {}): string {
  const e = edits[line.id];
  const text = lang === 'fr' ? (e && 'fr' in e ? e.fr : line.fr) : e && 'en' in e ? e.en : line.en;
  return (text ?? '').trim();
}

export function segmentState(
  line: SubtitleLine,
  index: number,
  current: number,
  validated: ReadonlySet<string>,
): SegmentState {
  if (index === current) return 'en_cours';
  return validated.has(line.id) ? 'validee' : 'a_verifier';
}

/** Ligne à risque encore à vérifier (marque sur la frise, filtre « À vérifier d'abord »). */
export function needsCheck(line: SubtitleLine, validated: ReadonlySet<string>): boolean {
  return isRisky(line) && !validated.has(line.id);
}

/** Index (dans `lines`, ordre chronologique) des lignes montrées par le filtre. */
export function visibleIndexes(
  lines: SubtitleLine[],
  filter: ViewerFilter,
  validated: ReadonlySet<string>,
): number[] {
  return lines.flatMap((l, i) => (filter === 'toutes' || needsCheck(l, validated) ? [i] : []));
}

/** Prochaine ligne dans la liste filtrée après `current` (null : fin de la liste). */
export function nextIndex(visible: number[], current: number): number | null {
  return visible.find((i) => i > current) ?? null;
}

/** Ligne précédente dans la liste filtrée avant `current` (null : début de la liste). */
export function previousIndex(visible: number[], current: number): number | null {
  const before = visible.filter((i) => i < current);
  return before.length ? before[before.length - 1] : null;
}

/** Filtre au départ : « À vérifier d'abord » s'il reste des lignes à risque, sinon « Toutes ». */
export function initialFilter(lines: SubtitleLine[]): ViewerFilter {
  return lines.some((l) => isRisky(l) && !l.validated) ? 'risque' : 'toutes';
}

/** « elevenlabs/scribe_v2 » → « scribe v2 » ; « gemini/gemini-3.1-flash-lite » → « gemini-3.1-flash-lite ». */
export function toolName(id: string): string {
  return (id.split('/').pop() ?? id).replace(/_/g, ' ');
}

/** Résumé de ce qui rend la ligne à vérifier (le détail est affiché juste en dessous). */
export function checkSummary(line: SubtitleLine): string | null {
  const parts: string[] = [];
  if (line.confidence === 'faible') parts.push('confiance faible');
  else if (line.confidence === 'moyenne') parts.push('confiance moyenne');
  const n = line.warnings?.length ?? 0;
  if (n) parts.push(`${n} avertissement${n > 1 ? 's' : ''} ci-dessous`);
  return isRisky(line) && parts.length ? parts.join(' · ') : null;
}
