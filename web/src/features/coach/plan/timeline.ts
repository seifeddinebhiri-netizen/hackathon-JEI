import type {
  Calibration,
  CalibrationField,
  NumRange,
  ShotChoices,
  ShotTargets,
  Timeline,
  TimelineSegment,
} from '@/api/types';
import { choicesOf, computeTargets } from './computeTargets';

/**
 * Plan en mouvement : une prise décrite par des passages, comptés en secondes depuis le début de la
 * prise. À chaque instant, le Coach compare l'image aux cibles du passage en cours (et, si le cadrage
 * évolue pendant le passage, à des cibles qui glissent du début vers la fin).
 */
export const MIN_SEGMENT_S = 0.5;
export const MAX_SEGMENTS = 8;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

// --- Cibles à un instant donné ---------------------------------------------------------

/** Le passage en cours à l'instant `t` (secondes). Avant le début : le premier ; après la fin : le dernier. */
export function segmentIndexAt(tl: Timeline, t: number): number {
  if (t <= 0) return 0;
  const i = tl.segments.findIndex((s) => t < s.end_s);
  return i === -1 ? tl.segments.length - 1 : i;
}

const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** Glisse de a vers b. Si l'un des deux manque (ex. le visage disparaît), on garde la valeur du début. */
function lerpRange(a: NumRange | null, b: NumRange | null, p: number): NumRange | null {
  return a && b ? { min: lerp(a.min, b.min, p), max: lerp(a.max, b.max, p) } : a;
}
const lerpNum = (a: number | null, b: number | null, p: number): number | null =>
  a !== null && b !== null ? lerp(a, b, p) : a;

export function lerpTargets(a: ShotTargets, b: ShotTargets, p: number): ShotTargets {
  return {
    roll_abs_deg: lerpRange(a.roll_abs_deg, b.roll_abs_deg, p)!,
    pitch_deg: lerpRange(a.pitch_deg, b.pitch_deg, p),
    subject_h: lerpRange(a.subject_h, b.subject_h, p),
    center_x: lerpRange(a.center_x, b.center_x, p),
    center_y: lerpRange(a.center_y, b.center_y, p),
    headroom: lerpRange(a.headroom, b.headroom, p),
    luma: lerpRange(a.luma, b.luma, p)!,
    contrast: lerpRange(a.contrast, b.contrast, p)!,
    backlight_ratio_max: lerpNum(a.backlight_ratio_max, b.backlight_ratio_max, p),
    sun_offset_abs_deg: lerpRange(a.sun_offset_abs_deg, b.sun_offset_abs_deg, p),
    shake_max: lerpNum(a.shake_max, b.shake_max, p),
  };
}

/** Les cibles à l'instant `t` : celles du passage en cours, qui glissent du début vers la fin s'il évolue. */
export function targetsAt(tl: Timeline, t: number): ShotTargets {
  const seg = tl.segments[segmentIndexAt(tl, t)];
  if (!seg.targets_end) return seg.targets_start;
  const span = seg.end_s - seg.start_s;
  const p = span > 0 ? clamp((t - seg.start_s) / span, 0, 1) : 1;
  return lerpTargets(seg.targets_start, seg.targets_end, p);
}

/** Recalcule les cibles de chaque passage à partir de ses mots (après une modification). */
export function recomputeTimeline(tl: Timeline, cal: Calibration): Timeline {
  return {
    ...tl,
    segments: tl.segments.map((s) => ({
      ...s,
      targets_start: computeTargets(choicesOf(s.at_start), cal),
      targets_end: s.at_end ? computeTargets(choicesOf(s.at_end), cal) : null,
    })),
  };
}

// --- Modifications faites par l'utilisateur (toutes pures : elles renvoient une nouvelle chronologie) ---

const withSegment = (tl: Timeline, index: number, change: Partial<TimelineSegment>): Timeline => ({
  ...tl,
  segments: tl.segments.map((s, i) => (i === index ? { ...s, ...change } : s)),
});

export function setChoice<K extends keyof ShotChoices>(
  tl: Timeline,
  index: number,
  which: 'start' | 'end',
  key: K,
  value: ShotChoices[K],
): Timeline {
  const seg = tl.segments[index];
  if (which === 'start') return withSegment(tl, index, { at_start: { ...seg.at_start, [key]: value } });
  const base = seg.at_end ?? seg.at_start;
  return withSegment(tl, index, { at_end: { ...base, [key]: value } });
}

/** « Le cadrage évolue pendant ce passage » : activé, la fin part du début ; désactivé, il n'y a plus de fin. */
export function setEndEnabled(tl: Timeline, index: number, on: boolean): Timeline {
  const seg = tl.segments[index];
  return withSegment(tl, index, {
    at_end: on ? { ...seg.at_start } : null,
    targets_end: on ? seg.targets_start : null,
  });
}

export const setDescription = (tl: Timeline, index: number, text: string): Timeline =>
  withSegment(tl, index, { description_fr: text.slice(0, 300) });

/** Déplace la limite entre le passage `index` et le suivant, sans jamais faire disparaître un passage. */
export function setBoundary(tl: Timeline, index: number, endS: number): Timeline {
  const next = tl.segments[index + 1];
  if (!next || !Number.isFinite(endS)) return tl;
  const end = round1(clamp(endS, tl.segments[index].start_s + MIN_SEGMENT_S, next.end_s - MIN_SEGMENT_S));
  return {
    ...tl,
    segments: tl.segments.map((s, i) =>
      i === index ? { ...s, end_s: end } : i === index + 1 ? { ...s, start_s: end } : s,
    ),
  };
}

/** Coupe un passage en deux au milieu. L'évolution éventuelle se poursuit dans la seconde moitié. */
export function splitSegment(tl: Timeline, index: number): Timeline | null {
  const seg = tl.segments[index];
  if (!seg || tl.segments.length >= MAX_SEGMENTS || seg.end_s - seg.start_s < 2 * MIN_SEGMENT_S) return null;
  const mid = round1((seg.start_s + seg.end_s) / 2);
  const used = new Set(tl.segments.map((s) => s.id));
  let n = 1;
  while (used.has(`${seg.id}-${n}`)) n++;
  const first: TimelineSegment = { ...seg, end_s: mid, at_end: null, targets_end: null };
  const second: TimelineSegment = {
    ...seg,
    id: `${seg.id}-${n}`,
    start_s: mid,
    description_fr: `${seg.description_fr} (suite)`.slice(0, 300),
  };
  return {
    ...tl,
    segments: [...tl.segments.slice(0, index), first, second, ...tl.segments.slice(index + 1)],
  };
}

/** Supprime un passage : le voisin prend sa place dans le temps. Impossible s'il n'en reste qu'un. */
export function removeSegment(tl: Timeline, index: number): Timeline | null {
  if (tl.segments.length <= 1 || !tl.segments[index]) return null;
  const seg = tl.segments[index];
  const rest = tl.segments.filter((_, i) => i !== index);
  if (index === 0) rest[0] = { ...rest[0], start_s: seg.start_s };
  else rest[index - 1] = { ...rest[index - 1], end_s: seg.end_s };
  return { ...tl, segments: rest };
}

/** Mêmes passages, mêmes mots, mêmes secondes ? (les cibles chiffrées n'entrent pas en compte) */
export function timelinesEqual(a: Timeline, b: Timeline): boolean {
  const view = (t: Timeline) =>
    JSON.stringify(t.segments.map((s) => [s.start_s, s.end_s, s.description_fr, s.at_start, s.at_end]));
  return a.duration_s === b.duration_s && view(a) === view(b);
}

// --- Explication en français -----------------------------------------------------------

const short = (label: string) => label.replace(/\s*\(.*?\)/g, '').trim();
const labelOf = (vocab: CalibrationField[], key: keyof ShotChoices, value: string) =>
  short(vocab.find((f) => f.key === key)?.options.find((o) => o.value === value)?.label_fr ?? value);

const SUBJECTS_WITH_VIEW = ['person', 'face', 'hands'];

/** Le cadrage en mots courts. `only` : seulement ces champs (pour décrire ce qui change). */
export function describeChoices(
  c: ShotChoices,
  vocab: CalibrationField[],
  only?: ReadonlySet<keyof ShotChoices>,
): string[] {
  const parts: string[] = [];
  const show = (key: keyof ShotChoices) => !only || only.has(key);
  if (show('size')) parts.push(labelOf(vocab, 'size', c.size));
  if (show('subject_kind')) parts.push(labelOf(vocab, 'subject_kind', c.subject_kind));
  if (show('subject_view') && SUBJECTS_WITH_VIEW.includes(c.subject_kind))
    parts.push(labelOf(vocab, 'subject_view', c.subject_view));
  if (show('subject_position') && c.subject_kind !== 'none')
    parts.push(labelOf(vocab, 'subject_position', c.subject_position));
  if (show('camera_angle')) parts.push(labelOf(vocab, 'camera_angle', c.camera_angle));
  if (show('tilt') && c.tilt !== 'level')
    parts.push(`horizon ${labelOf(vocab, 'tilt', c.tilt).toLowerCase()}`);
  if (show('movement') && c.movement !== 'static') parts.push(labelOf(vocab, 'movement', c.movement));
  return parts;
}

const CHOICE_FIELDS = [
  'size',
  'subject_kind',
  'subject_view',
  'subject_position',
  'camera_angle',
  'tilt',
  'light_contrast',
  'exposure',
  'backlight',
  'sun_relative',
  'stability',
  'movement',
] as const;

/** Les champs qui changent entre le début et la fin d'un passage. */
export function changedFields(seg: TimelineSegment): Set<keyof ShotChoices> {
  const changed = new Set<keyof ShotChoices>();
  if (seg.at_end) for (const k of CHOICE_FIELDS) if (seg.at_end[k] !== seg.at_start[k]) changed.add(k);
  return changed;
}

/** « 0 s » / « 2,5 s » */
export const formatSeconds = (s: number): string => `${Number(s.toFixed(1)).toString().replace('.', ',')} s`;

/** Le passage en une phrase : sa durée, son cadrage, et ce qui change pendant qu'il se déroule. */
export function describeSegment(seg: TimelineSegment, vocab: CalibrationField[]): string {
  const span = `De ${formatSeconds(seg.start_s).replace(' s', '')} à ${formatSeconds(seg.end_s)}`;
  const start = describeChoices(seg.at_start, vocab).join(' · ');
  const changed = changedFields(seg);
  const end = seg.at_end && changed.size > 0 ? describeChoices(seg.at_end, vocab, changed).join(' · ') : '';
  return `${span} : ${start}${end ? `, puis ${end}` : ''}`;
}
