import { describe, expect, it } from 'vitest';
import type { Calibration, CalibrationField, ShotChoices, Timeline } from '@/api/types';
import { computeTargets } from './computeTargets';
import fixture from './fixtures/targets_cases.json';
import { resolveTimeline } from './resolve';
import {
  describeChoices,
  describeSegment,
  formatSeconds,
  lerpTargets,
  recomputeTimeline,
  removeSegment,
  segmentIndexAt,
  setBoundary,
  setChoice,
  setEndEnabled,
  splitSegment,
  targetsAt,
  timelinesEqual,
} from './timeline';

const calibration = fixture.calibration as unknown as Calibration;
const vocabulary: CalibrationField[] = calibration.vocabulary;
const base = fixture.cases[0].intent as unknown as ShotChoices; // MS, une personne de face, au centre, à hauteur des yeux

const mk = (
  id: string,
  start: number,
  end: number,
  at_start: ShotChoices,
  at_end: ShotChoices | null = null,
) => ({
  id,
  start_s: start,
  end_s: end,
  description_fr: id,
  at_start,
  at_end,
  targets_start: computeTargets(at_start, calibration),
  targets_end: at_end ? computeTargets(at_end, calibration) : null,
});

const gone: ShotChoices = { ...base, subject_kind: 'none', subject_view: 'not_applicable' };
/** 0–3 s : visage au centre. 3–10 s : plus de visage, la caméra passe de la contre-plongée à la plongée. */
const tl: Timeline = {
  duration_s: 10,
  how_fr: 'Pendant 10 secondes…',
  segments: [
    mk('a', 0, 3, base),
    mk('b', 3, 10, { ...gone, camera_angle: 'low' }, { ...gone, camera_angle: 'high' }),
  ],
};

describe('cibles à un instant donné', () => {
  it('le passage en cours dépend des secondes écoulées', () => {
    expect([-1, 0, 2.9, 3, 9.9, 10, 99].map((t) => segmentIndexAt(tl, t))).toEqual([0, 0, 0, 1, 1, 1, 1]);
  });

  it('0–3 s : un visage est attendu ; après 3 s : plus de visage attendu', () => {
    expect(targetsAt(tl, 1).center_x).not.toBeNull();
    expect(targetsAt(tl, 1).headroom).not.toBeNull();
    expect(targetsAt(tl, 5).center_x).toBeNull();
    expect(targetsAt(tl, 5).headroom).toBeNull();
  });

  it('l’angle glisse de la contre-plongée à la plongée pendant le deuxième passage', () => {
    const at = (t: number) => targetsAt(tl, t).pitch_deg!;
    expect(at(3).min).toBeGreaterThan(0); // caméra vers le haut
    expect(at(10).max).toBeLessThan(0); // caméra vers le bas
    expect(at(6.5).min).toBeLessThan(at(3).min); // et ça descend régulièrement
    expect(at(8).min).toBeLessThan(at(6.5).min);
    expect(at(0)).toEqual(tl.segments[0].targets_start.pitch_deg); // un passage sans évolution ne bouge pas
    expect(targetsAt(tl, 2.9).pitch_deg).toEqual(at(0));
  });

  it('avant le début : le cadrage de départ ; après la fin : le cadrage final', () => {
    expect(targetsAt(tl, -5)).toEqual(tl.segments[0].targets_start);
    expect(targetsAt(tl, 500)).toEqual(tl.segments[1].targets_end);
  });

  it('le sujet qui glisse de la droite vers la gauche : la position visée suit', () => {
    const right: ShotChoices = { ...base, subject_position: 'right_third' };
    const left: ShotChoices = { ...base, subject_position: 'left_third' };
    const move: Timeline = { ...tl, segments: [mk('m', 0, 10, right, left)] };
    const x = (t: number) => targetsAt(move, t).center_x!;
    expect(x(0).min).toBeGreaterThan(0.6);
    expect(x(10).max).toBeLessThan(0.4);
    expect(x(5).min).toBeGreaterThan(x(10).min);
    expect(x(5).min).toBeLessThan(x(0).min);
  });

  it('si l’un des deux cadrages n’a plus de sujet, on garde les valeurs du début', () => {
    const t = lerpTargets(computeTargets(base, calibration), computeTargets(gone, calibration), 0.5);
    expect(t.center_x).toEqual(computeTargets(base, calibration).center_x);
  });
});

describe('modifier la chronologie', () => {
  it('changer un mot du passage recalcule ses chiffres', () => {
    const edited = setChoice(tl, 0, 'start', 'camera_angle', 'high');
    expect(edited.segments[0].at_start.camera_angle).toBe('high');
    expect(timelinesEqual(edited, tl)).toBe(false);
    expect(recomputeTimeline(edited, calibration).segments[0].targets_start.pitch_deg!.max).toBeLessThan(0);
    expect(edited.segments[0].targets_start).toEqual(tl.segments[0].targets_start); // avant recalcul : inchangés
  });

  it('« le cadrage évolue » : la fin part du début, puis se modifie ; désactivé, la fin disparaît', () => {
    const on = setEndEnabled(tl, 0, true);
    expect(on.segments[0].at_end).toEqual(base);
    const moved = setChoice(on, 0, 'end', 'subject_position', 'right_third');
    expect(recomputeTimeline(moved, calibration).segments[0].targets_end!.center_x!.min).toBeGreaterThan(0.6);
    expect(setEndEnabled(moved, 0, false).segments[0].at_end).toBeNull();
  });

  it('déplacer la limite entre deux passages : bornée, jamais de passage qui disparaît', () => {
    const moved = setBoundary(tl, 0, 5);
    expect([moved.segments[0].end_s, moved.segments[1].start_s]).toEqual([5, 5]);
    expect(setBoundary(tl, 0, 99).segments[0].end_s).toBe(9.5);
    expect(setBoundary(tl, 0, -3).segments[0].end_s).toBe(0.5);
    expect(setBoundary(tl, 1, 5)).toBe(tl); // le dernier passage finit à la durée
  });

  it('couper un passage en deux, puis en supprimer un, garde la prise continue de 0 à la durée', () => {
    const split = splitSegment(tl, 1)!;
    expect(split.segments.map((s) => [s.start_s, s.end_s])).toEqual([
      [0, 3],
      [3, 6.5],
      [6.5, 10],
    ]);
    expect(split.segments[1].at_end).toBeNull(); // l'évolution continue dans la seconde moitié
    expect(split.segments[2].at_end).not.toBeNull();
    expect(new Set(split.segments.map((s) => s.id)).size).toBe(3);
    const removed = removeSegment(split, 1)!;
    // le passage précédent prend la place de celui qu'on supprime : la prise reste continue
    expect(removed.segments.map((s) => [s.start_s, s.end_s])).toEqual([
      [0, 6.5],
      [6.5, 10],
    ]);
    expect(removeSegment(split, 0)!.segments[0].start_s).toBe(0);
    expect(removeSegment({ ...tl, segments: [tl.segments[0]] }, 0)).toBeNull(); // il en faut au moins un
  });

  it('pas plus de 8 passages, pas de passage trop court', () => {
    let t: Timeline | null = { ...tl, duration_s: 100, segments: [mk('x', 0, 100, base)] };
    for (let i = 0; i < 12 && t; i++) t = splitSegment(t, 0) ?? t;
    expect(t!.segments.length).toBeLessThanOrEqual(8);
    expect(splitSegment({ ...tl, segments: [mk('s', 0, 0.9, base)] }, 0)).toBeNull();
  });

  it('timelinesEqual ignore les chiffres, pas les mots ni les secondes', () => {
    expect(timelinesEqual(tl, recomputeTimeline(tl, calibration))).toBe(true);
    expect(timelinesEqual(tl, setBoundary(tl, 0, 4))).toBe(false);
  });
});

describe('chronologie modifiée : chiffres recalculés ou absents', () => {
  const shot = {
    id: 's',
    intent: { ...base, label_fr: 'x', why_fr: 'x', rule_ids: [], advice_fr: [] },
    targets: tl.segments[0].targets_start,
    rules: [],
    timeline: tl,
  };

  it('non modifiée : celle du serveur ; modifiée : recalculée ; sans calibration : pas de chiffres inventés', () => {
    expect(resolveTimeline(shot, undefined, undefined, 'v0-default')).toEqual({
      timeline: tl,
      edited: false,
    });
    expect(resolveTimeline(shot, recomputeTimeline(tl, calibration), undefined, 'v0-default')?.edited).toBe(
      false,
    );
    const edited = setChoice(tl, 0, 'start', 'camera_angle', 'high');
    const ok = resolveTimeline(shot, edited, calibration, 'v0-default')!;
    expect(ok.edited).toBe(true);
    expect(ok.timeline!.segments[0].targets_start.pitch_deg!.max).toBeLessThan(0);
    expect(resolveTimeline(shot, edited, undefined, 'v0-default')).toEqual({ timeline: null, edited: true });
    expect(
      resolveTimeline(shot, edited, { ...calibration, version: 'autre' }, 'v0-default')!.timeline,
    ).toBeNull();
    expect(resolveTimeline({ ...shot, timeline: null }, edited, calibration, 'v0-default')).toBeNull();
  });
});

describe('explication en français', () => {
  it('le cadrage en mots courts', () => {
    expect(describeChoices(base, vocabulary)).toEqual([
      'Plan moyen',
      'Une personne',
      'De face',
      'Au centre',
      'À hauteur des yeux',
    ]);
    expect(describeChoices(gone, vocabulary)).toEqual([
      'Plan moyen',
      'Pas de sujet précis',
      'À hauteur des yeux',
    ]); // plus de position ni de vue
  });

  it('un passage : ses secondes, son cadrage, et ce qui change pendant qu’il se déroule', () => {
    expect(describeSegment(tl.segments[0], vocabulary)).toBe(
      'De 0 à 3 s : Plan moyen · Une personne · De face · Au centre · À hauteur des yeux',
    );
    const text = describeSegment(tl.segments[1], vocabulary);
    expect(text).toContain('De 3 à 10 s : Plan moyen · Pas de sujet précis · En contre-plongée');
    expect(text).toContain(', puis En plongée'); // seul l'angle change
  });

  it('secondes avec virgule française', () => {
    expect(formatSeconds(3)).toBe('3 s');
    expect(formatSeconds(2.5)).toBe('2,5 s');
  });
});
