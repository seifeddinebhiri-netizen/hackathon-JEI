/**
 * Dépouillement du scénario par l'IA (POST /scenarios/analyze) → scènes et décors de l'assistant.
 * Règles : rien d'inventé. Les durées ne viennent pas de l'IA (1 h par défaut, à ajuster) ;
 * ce que l'IA n'a pas pu lire (INT/EXT, moment, lieu) est signalé et reste à valider.
 */
import type { Location, ParseScreenplayResult, Scene, SceneMoment, ScenarioAnalysis } from './types';

const MOMENTS: Record<ScenarioAnalysis['scenes'][number]['time_of_day'], SceneMoment | null> = {
  DAY: 'jour',
  NIGHT: 'nuit',
  DAWN: 'aube',
  DUSK: 'heure_doree',
  UNKNOWN: null,
};

const EXCERPT_MAX = 1200;

const newId = (prefix: string) =>
  `${prefix}-${globalThis.crypto?.randomUUID?.().slice(0, 8) ?? Math.random().toString(36).slice(2, 10)}`;

/** Texte de chaque scène, découpé sur les en-têtes renvoyés par l'IA (dans l'ordre du scénario). */
function excerpts(content: string, headings: string[]): (string | undefined)[] {
  const starts: number[] = [];
  let from = 0;
  for (const h of headings) {
    const i = content.indexOf(h.trim(), from);
    starts.push(i);
    if (i >= 0) from = i + h.trim().length;
  }
  return starts.map((start, k) => {
    if (start < 0) return undefined;
    const next = starts.slice(k + 1).find((s) => s > start) ?? content.length;
    const text = content.slice(start, next).trim();
    if (!text) return undefined;
    return text.length > EXCERPT_MAX ? `${text.slice(0, EXCERPT_MAX - 1)}…` : text;
  });
}

/** Titre court tiré du résumé (première phrase), sinon l'en-tête. */
function titleOf(summary: string, heading: string): string {
  const first = summary.split(/[.!?]/)[0]?.trim();
  return (first || heading).slice(0, 60);
}

export function analysisToParseResult(analysis: ScenarioAnalysis, content: string): ParseScreenplayResult {
  const locations = new Map<string, Location>();
  const unsure: string[] = [];
  const texts = excerpts(
    content,
    analysis.scenes.map((s) => s.heading),
  );

  const scenes: Scene[] = analysis.scenes.map((s, k) => {
    const place = s.location.trim() || 'Lieu à préciser';
    const key = place.toLowerCase();
    if (!locations.has(key))
      locations.set(key, {
        id: newId('loc'),
        name: place,
        address: '',
        forbidden_days: [],
        permit: 'non_necessaire',
      });
    const moment = MOMENTS[s.time_of_day];
    if (s.setting === 'UNKNOWN' || !moment || !s.location.trim()) unsure.push(String(s.number));
    const excerpt = texts[k];
    return {
      id: newId('sc'),
      number: String(s.number),
      title: titleOf(s.summary, s.heading),
      setting: s.setting === 'EXT' ? 'EXT' : 'INT',
      moment: moment ?? 'jour',
      location_id: locations.get(key)!.id,
      characters: s.characters.filter(Boolean),
      estimated_hours: 1,
      summary: s.summary,
      ...(excerpt ? { excerpt } : {}),
      source: 'import_ia',
      validated: false,
    };
  });

  const warnings = ['Durées de tournage : 1 h par défaut pour chaque scène, à ajuster.'];
  if (unsure.length)
    warnings.unshift(
      `Intérieur/extérieur, moment ou lieu pas clairs dans le texte pour ${
        unsure.length > 1 ? 'les scènes' : 'la scène'
      } ${unsure.join(', ')} : vérifie-les.`,
    );
  if (analysis.simulated) warnings.unshift('Analyse simulée (exemple) : ce n’est pas ton scénario.');
  return {
    scenes,
    locations: [...locations.values()],
    characters: analysis.characters.map((c) => c.name),
    warnings,
  };
}
