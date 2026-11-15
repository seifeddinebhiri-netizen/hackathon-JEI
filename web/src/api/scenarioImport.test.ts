import { describe, expect, it } from 'vitest';
import { parseScreenplay } from './endpoints';
import { analysisToParseResult } from './scenarioImport';
import { scenarioAnalysisSchema } from './schemas';
import type { ScenarioAnalysis } from './types';

const CONTENT = `INT. CAFÉ - JOUR
Amira lève le rideau. Le café est vide.

EXT. RUELLE - CRÉPUSCULE
Amira court derrière Slim.

??? QUELQUE PART
Slim attend.`;

const scene = (over: Partial<ScenarioAnalysis['scenes'][number]>) => ({
  number: 1,
  heading: 'INT. CAFÉ - JOUR',
  setting: 'INT' as const,
  time_of_day: 'DAY' as const,
  location: 'Café',
  summary: 'Amira lève le rideau. Le café est vide.',
  characters: ['Amira'],
  props: [],
  technical_requirements: [],
  production_challenges: [],
  missing_information: [],
  inferences: [],
  suggestions: [],
  ...over,
});

const ANALYSIS: ScenarioAnalysis = {
  title: 'Marée basse',
  status: 'Brouillon IA : à valider',
  simulated: false,
  scenes: [
    scene({}),
    scene({
      number: 2,
      heading: 'EXT. RUELLE - CRÉPUSCULE',
      setting: 'EXT',
      time_of_day: 'DUSK',
      location: 'Ruelle',
      summary: 'Amira court derrière Slim.',
      characters: ['Amira', 'Slim'],
    }),
    scene({
      number: 3,
      heading: '??? QUELQUE PART',
      setting: 'UNKNOWN',
      time_of_day: 'UNKNOWN',
      location: '',
      summary: 'Slim attend.',
      characters: ['Slim'],
    }),
  ],
  characters: [
    { name: 'Amira', description: '', scenes: [1, 2], production_observations: [] },
    { name: 'Slim', description: '', scenes: [2, 3], production_observations: [] },
  ],
};

describe('analysisToParseResult', () => {
  it('convertit le dépouillement IA en scènes et décors à valider', () => {
    expect(scenarioAnalysisSchema.safeParse(ANALYSIS).success).toBe(true);
    const r = analysisToParseResult(ANALYSIS, CONTENT);
    expect(r.locations.map((l) => l.name)).toEqual(['Café', 'Ruelle', 'Lieu à préciser']);
    expect(r.characters).toEqual(['Amira', 'Slim']);
    const [a, b, c] = r.scenes;
    expect(a).toMatchObject({ number: '1', title: 'Amira lève le rideau', setting: 'INT', moment: 'jour' });
    expect(b).toMatchObject({ setting: 'EXT', moment: 'heure_doree', location_id: r.locations[1].id });
    // Rien d'inventé : durée par défaut, scène à valider, inconnu signalé
    expect(r.scenes.every((s) => s.estimated_hours === 1 && !s.validated && s.source === 'import_ia')).toBe(
      true,
    );
    expect(c).toMatchObject({ setting: 'INT', moment: 'jour' });
    expect(r.warnings[0]).toBe(
      'Intérieur/extérieur, moment ou lieu pas clairs dans le texte pour la scène 3 : vérifie-les.',
    );
    expect(r.warnings).toContain('Durées de tournage : 1 h par défaut pour chaque scène, à ajuster.');
  });

  it('garde un extrait du texte de chaque scène', () => {
    const r = analysisToParseResult(ANALYSIS, CONTENT);
    expect(r.scenes[0].excerpt).toBe('INT. CAFÉ - JOUR\nAmira lève le rideau. Le café est vide.');
    expect(r.scenes[1].excerpt).toBe('EXT. RUELLE - CRÉPUSCULE\nAmira court derrière Slim.');
  });
});

describe('parseScreenplay (backend)', () => {
  it('refuse un PDF : le découpage par l’IA lit du texte', async () => {
    const pdf = new File(['%PDF'], 'scenario.pdf', { type: 'application/pdf' });
    await expect(parseScreenplay({ file: pdf })).rejects.toMatchObject({
      code: 'invalide',
      message:
        'Pour le découpage par l’IA, colle le texte du scénario ou importe un fichier .txt ou .fountain.',
    });
  });
});
