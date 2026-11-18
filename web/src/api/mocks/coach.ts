/**
 * Plan de prise de vue SIMULÉ (aucun appel à l'IA) : sert à la démonstration quand le Coach n'est
 * pas branché au backend (VITE_REAL_COACH=false). Les sources des règles sont les vraies sources
 * de backend/rules/rules.json (R-008 et R-010). Comme le vrai backend : UN seul plan par scène ;
 * pour un plan en mouvement, une chronologie en secondes.
 */
import calibrationFixture from '@/features/coach/plan/fixtures/targets_cases.json';
import { choicesOf, computeTargets } from '@/features/coach/plan/computeTargets';
import type {
  Calibration,
  PlanShot,
  RuleRef,
  ShotChoices,
  ShotIntent,
  ShotSpec,
  ShotSpecRequest,
  Timeline,
} from '../types';

export const mockCalibration = calibrationFixture.calibration as unknown as Calibration;

const R008: RuleRef = {
  id: 'R-008',
  title_fr: 'Règle des tiers',
  confidence: 'high',
  sources: [
    {
      title: 'Rule of thirds (Wikipedia)',
      author: null,
      url: 'https://en.wikipedia.org/wiki/Rule_of_thirds',
      type: 'encyclopedia',
    },
  ],
};
const R010: RuleRef = {
  id: 'R-010',
  title_fr: 'Les yeux vers le tiers supérieur',
  confidence: 'high',
  sources: [
    {
      title: 'Headroom (photographic framing) (Wikipedia)',
      author: null,
      url: 'https://en.wikipedia.org/wiki/Headroom_(photographic_framing)',
      type: 'encyclopedia',
    },
  ],
};

const round1 = (v: number) => Math.round(v * 10) / 10;

function baseChoices(req: ShotSpecRequest): ShotChoices {
  const exterior = req.setting === 'EXT' || req.setting === 'exterior';
  const dark = (req.mood ?? []).some((m) => /tendu|sombre|myst|angoiss/i.test(m)) || req.moment === 'nuit';
  return {
    size: 'MS',
    subject_kind: 'person',
    subject_view: 'front',
    subject_position: 'left_third',
    camera_angle: 'eye_level',
    tilt: 'level',
    light_contrast: dark ? 'high' : 'medium_low',
    exposure: dark ? 'dark' : 'balanced',
    backlight: 'avoid',
    sun_relative: exterior ? 'front' : 'not_applicable',
    stability: req.support === 'tripod' ? 'tripod' : 'handheld',
    movement: 'static',
  };
}

/** Un plan en mouvement d'exemple : le personnage au tiers droit, puis il glisse à gauche, puis plus de visage. */
function mockTimeline(base: ShotChoices, shotId: string, duration: number): Timeline {
  const a = round1(duration * 0.3);
  const b = round1(duration * 0.75);
  const person: ShotChoices = { ...base, subject_position: 'right_third', movement: 'tracking' };
  const gone: ShotChoices = {
    ...base,
    subject_kind: 'none',
    subject_view: 'not_applicable',
    camera_angle: 'low',
    movement: 'tilt',
  };
  const seg = (
    i: number,
    start: number,
    end: number,
    description_fr: string,
    at_start: ShotChoices,
    at_end: ShotChoices | null,
  ) => ({
    id: `${shotId}-s${i}`,
    start_s: start,
    end_s: end,
    description_fr,
    at_start,
    at_end,
    targets_start: computeTargets(at_start, mockCalibration),
    targets_end: at_end ? computeTargets(at_end, mockCalibration) : null,
  });
  return {
    duration_s: duration,
    how_fr: `Pendant ${duration} secondes, tu suis le personnage : il passe du tiers droit au tiers gauche, puis il sort du cadre et ta caméra se lève. [Exemple simulé]`,
    segments: [
      seg(1, 0, a, 'Le personnage est au tiers droit, tu le suis.', person, {
        ...person,
        subject_position: 'center',
      }),
      seg(
        2,
        a,
        b,
        'Il glisse vers le tiers gauche.',
        { ...person, subject_position: 'center' },
        { ...person, subject_position: 'left_third' },
      ),
      seg(3, b, duration, 'Il sort du cadre : plus de visage, la caméra monte.', gone, {
        ...gone,
        camera_angle: 'high',
      }),
    ],
  };
}

export function mockShotSpec(req: ShotSpecRequest): ShotSpec {
  const sceneId = req.scene_id ?? 'demo';
  const shotId = `${sceneId}-a`;
  const base = baseChoices(req);
  const moving = req.motion === 'moving';
  let shot: PlanShot;

  if (moving) {
    const timeline = mockTimeline(base, shotId, req.duration_s ?? 10);
    const first = timeline.segments[0];
    const intent: ShotIntent = {
      ...first.at_start,
      label_fr: 'Travelling sur le personnage',
      why_fr: 'Suivre le personnage garde l’énergie de la scène. [Exemple simulé]',
      rule_ids: ['R-008', 'R-010'],
      advice_fr: [
        'Commence le mouvement avant que le personnage entre dans le cadre, garde une vitesse régulière.',
      ],
    };
    shot = { id: shotId, intent, targets: first.targets_start, rules: [R008, R010], timeline };
  } else {
    const intent: ShotIntent = {
      ...base,
      label_fr: 'Plan moyen sur le personnage',
      why_fr: 'Le personnage sur le tiers gauche laisse de la place au regard. [Exemple simulé]',
      rule_ids: ['R-008', 'R-010'],
      advice_fr: ['Pose les coudes contre le corps pour limiter le tremblement.'],
    };
    shot = {
      id: shotId,
      intent,
      targets: computeTargets(choicesOf(intent), mockCalibration),
      rules: [R008, R010],
    };
  }

  return {
    scene_id: sceneId,
    status: 'Brouillon IA : à valider',
    calibration: mockCalibration.version,
    model: 'mock (aucun appel à l’IA)',
    generated_at: new Date().toISOString(),
    shots: [shot],
  };
}
