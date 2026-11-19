import { beforeEach, describe, expect, it } from 'vitest';
import type { Calibration, PlanShot, Scene, ShotSpec } from '@/api/types';
import fixture from './fixtures/targets_cases.json';
import { describeTargets } from './format';
import { resolveShot, withOverride } from './resolve';
import { sceneToRequest } from './sceneDefaults';
import { loadCalibration, loadPlan, savePlan, saveCalibration, clearPlan, type StoredPlan } from './store';
import { computeTargets } from './computeTargets';

const calibration = fixture.calibration as unknown as Calibration;
const choices = fixture.cases[0].intent as unknown as PlanShot['intent'];
const shot: PlanShot = {
  id: 's-a',
  intent: { ...choices, label_fr: 'Plan', why_fr: 'Parce que', rule_ids: ['R-008'], advice_fr: [] },
  targets: computeTargets(choices, calibration),
  rules: [],
};
const spec: ShotSpec = {
  scene_id: 's',
  status: 'Brouillon IA : à valider',
  calibration: calibration.version,
  model: 'test',
  generated_at: '2026-11-18T10:00:00Z',
  shots: [shot],
};
const stored: StoredPlan = {
  request: { description: 'Une scène de test' },
  spec,
  overrides: {},
  notes: {},
  timelines: {},
  savedAt: 'x',
};

describe('résolution des cibles', () => {
  it('plan non modifié : on garde les cibles du serveur, sans calibration nécessaire', () => {
    const r = resolveShot(shot, undefined, undefined, spec.calibration);
    expect(r.edited).toEqual([]);
    expect(r.targets).toBe(shot.targets);
  });

  it('plan modifié : cibles recalculées avec la calibration', () => {
    const r = resolveShot(shot, { camera_angle: 'low' }, calibration, spec.calibration);
    expect(r.edited).toEqual(['camera_angle']);
    expect(r.targets!.pitch_deg!.min).toBeGreaterThan(0);
  });

  it('plan modifié sans calibration (ou d’une autre version) : cibles inconnues, pas de faux chiffres', () => {
    expect(resolveShot(shot, { size: 'WS' }, undefined, spec.calibration).targets).toBeNull();
    expect(
      resolveShot(shot, { size: 'WS' }, { ...calibration, version: 'autre' }, spec.calibration).targets,
    ).toBeNull();
  });

  it('remettre la valeur de l’IA annule la modification', () => {
    const o = withOverride({ camera_angle: 'low' }, shot.intent, 'camera_angle', shot.intent.camera_angle);
    expect(o).toEqual({});
    expect(withOverride(undefined, shot.intent, 'size', 'WS')).toEqual({ size: 'WS' });
  });
});

describe('sauvegarde locale', () => {
  beforeEach(() => localStorage.clear());

  it('aller-retour, rangé par utilisateur', () => {
    savePlan('u1', { ...stored, overrides: { 's-a': { size: 'WS' } } });
    expect(loadPlan('u1')?.overrides).toEqual({ 's-a': { size: 'WS' } });
    expect(loadPlan('u2')).toBeNull();
    clearPlan('u1');
    expect(loadPlan('u1')).toBeNull();
  });

  it('contenu corrompu ou invalide : ignoré, sans erreur', () => {
    localStorage.setItem('pp-coach-plan-v1:u1', '{pas du json');
    expect(loadPlan('u1')).toBeNull();
    localStorage.setItem('pp-coach-plan-v1:u1', JSON.stringify({ spec: { shots: 'non' } }));
    expect(loadPlan('u1')).toBeNull();
  });

  it('modifications invalides retirées (valeur hors vocabulaire)', () => {
    savePlan('u1', { ...stored, overrides: { 's-a': { size: 'XXL' as never, tilt: 'dutch' } } });
    expect(loadPlan('u1')?.overrides).toEqual({});
    // (un objet partiellement invalide est refusé en entier : on préfère perdre la modification que garder une valeur fausse)
  });

  it('calibration mise en cache', () => {
    expect(loadCalibration()).toBeNull();
    saveCalibration(calibration);
    expect(loadCalibration()?.version).toBe(calibration.version);
  });
});

describe('affichage des cibles et reprise d’une scène', () => {
  it('cibles en phrases', () => {
    const rows = describeTargets(shot.targets);
    expect(rows.map((r) => r.label)).toEqual(
      expect.arrayContaining(['Horizon', 'Angle de la caméra', 'Luminosité', 'Tremblement']),
    );
    expect(rows.find((r) => r.label === 'Horizon')!.value).toBe('incliné de 2° au plus');
  });

  it('une scène du planning devient une demande préremplie', () => {
    const scene = {
      id: 'sc-1',
      number: '1',
      title: 'Amira ouvre le café',
      setting: 'INT',
      moment: 'jour',
      location_id: 'l',
      characters: ['Amira'],
      estimated_hours: 2,
      summary: 'Elle lève le rideau.',
      source: 'manuel',
      validated: true,
    } as Scene;
    expect(sceneToRequest(scene, undefined)).toMatchObject({
      description: 'Amira ouvre le café : Elle lève le rideau.',
      scene_id: 'sc-1',
      setting: 'INT',
      moment: 'jour',
      characters: ['Amira'],
    });
  });
});

import { EMPTY, fromRequest, parseDuration, schema, toRequest } from './sceneValues';

describe('formulaire de scène', () => {
  it('seuls les champs remplis partent à l’IA', () => {
    expect(toRequest({ ...EMPTY, description: 'Un vieil homme boit son thé.' })).toEqual({
      description: 'Un vieil homme boit son thé.',
    });
    expect(
      toRequest(
        {
          ...EMPTY,
          description: 'Un vieil homme boit son thé.',
          setting: 'INT',
          moment: 'nuit',
          characters: ' Amira , Mounir,, ',
          mood: ['Tendue', 'Intime'],
          moodOther: 'fébrile',
          support: 'tripod',
        },
        'sc-1',
      ),
    ).toEqual({
      description: 'Un vieil homme boit son thé.',
      scene_id: 'sc-1',
      setting: 'INT',
      moment: 'nuit',
      characters: ['Amira', 'Mounir'],
      mood: ['Tendue', 'Intime', 'fébrile'],
      support: 'tripod',
    });
  });

  it('la description est obligatoire (10 caractères), 5 ambiances au maximum', () => {
    expect(schema.safeParse({ ...EMPTY, description: 'court' }).success).toBe(false);
    expect(schema.safeParse({ ...EMPTY, description: 'Une description assez longue.' }).success).toBe(true);
    expect(
      schema.safeParse({
        ...EMPTY,
        description: 'Une description assez longue.',
        mood: ['a', 'b', 'c', 'd', 'e', 'f'],
      }).success,
    ).toBe(false);
  });

  it('aller-retour demande ↔ formulaire', () => {
    const request = {
      description: 'Une description assez longue.',
      setting: 'EXT' as const,
      mood: ['Tendue', 'fébrile'],
      characters: ['Amira'],
    };
    const values = fromRequest(request);
    expect(values.mood).toEqual(['Tendue']);
    expect(values.moodOther).toBe('fébrile');
    expect(toRequest(values)).toMatchObject({
      setting: 'EXT',
      mood: ['Tendue', 'fébrile'],
      characters: ['Amira'],
    });
  });
});

describe('durée des plans en mouvement', () => {
  const base = { ...EMPTY, description: 'Amira court dans la ruelle.' };

  it('lecture de la durée saisie', () => {
    expect(parseDuration('10')).toBe(10);
    expect(parseDuration(' 7,5 ')).toBe(7.5);
    for (const bad of ['', 'abc', '1', '121', '-3']) expect(parseDuration(bad), bad).toBeNull();
  });

  it('un plan en mouvement exige une durée ; un plan fixe l’ignore', () => {
    expect(schema.safeParse({ ...base, motion: 'moving' }).success).toBe(false);
    expect(schema.safeParse({ ...base, motion: 'moving', duration: '12' }).success).toBe(true);
    expect(schema.safeParse({ ...base, motion: 'fixed' }).success).toBe(true);
    expect(schema.safeParse({ ...base, motion: 'unknown', duration: 'n’importe quoi' }).success).toBe(true);
  });

  it('la durée part avec la demande seulement pour un plan en mouvement', () => {
    expect(toRequest({ ...base, motion: 'moving', duration: '7,5' })).toMatchObject({
      motion: 'moving',
      duration_s: 7.5,
    });
    expect(toRequest({ ...base, motion: 'fixed', duration: '10' })).not.toHaveProperty('duration_s');
    expect(
      fromRequest({ description: 'Une scène assez longue.', motion: 'moving', duration_s: 7.5 }).duration,
    ).toBe('7,5');
  });
});
