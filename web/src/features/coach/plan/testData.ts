import type { Calibration, PlanShot, ShotChoices, ShotSpec, WorkspaceRecord } from '@/api/types';
import { computeTargets } from './computeTargets';
import fixture from './fixtures/targets_cases.json';
import type { StoredPlan } from './store';

/** Données d'essai communes aux tests des espaces de travail. */
const calibration = fixture.calibration as unknown as Calibration;
const choices = fixture.cases[0].intent as unknown as ShotChoices;

export const NOW = '2026-11-18T10:00:00Z';

export const shot: PlanShot = {
  id: 's-a',
  intent: { ...choices, label_fr: 'Plan', why_fr: 'Parce que', rule_ids: ['R-008'], advice_fr: [] },
  targets: computeTargets(choices, calibration),
  rules: [],
};

export const spec: ShotSpec = {
  scene_id: 's',
  status: 'Brouillon IA : à valider',
  calibration: calibration.version,
  model: 'test',
  generated_at: NOW,
  shots: [shot],
};

export const plan = (description: string): StoredPlan => ({
  request: { description },
  spec,
  overrides: {},
  notes: {},
  timelines: {},
  savedAt: NOW,
});

/** Un espace tel que le serveur le renvoie. */
export const record = (
  id: string,
  name: string,
  version: number,
  updated = NOW,
  description = 'Une scène assez longue.',
): WorkspaceRecord => ({
  id,
  name,
  version,
  created_at: NOW,
  updated_at: updated,
  data: { request: { description }, spec, overrides: {}, notes: {}, timelines: {} },
});
