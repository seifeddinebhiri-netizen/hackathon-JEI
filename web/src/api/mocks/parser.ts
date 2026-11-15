/**
 * Découpage de scénario SIMULÉ. Lit les fichiers texte (TXT / Fountain) et la saisie libre :
 * repère les en-têtes « INT. LIEU - JOUR » / « EXT. LIEU - NUIT », les personnages (lignes en
 * capitales) et la première ligne d'action comme résumé.
 * PDF / DOCX : le mock ne lit pas le contenu et renvoie un découpage d'exemple (signalé).
 */
import type { Location, ParseScreenplayInput, ParseScreenplayResult, Scene, SceneMoment } from '@/api/types';
import { buildDemoProject } from './data/project';
import { uid } from './db';

const HEADING = /^\s*(?:\d+[.)]?\s*)?(INT\.?\s*\/\s*EXT|EXT\.?\s*\/\s*INT|I\/E|INT|EXT)[.\s]+(.+?)\s*$/i;

function momentFrom(text: string): SceneMoment {
  const t = text.toLowerCase();
  if (/(nuit|night|soir tard)/.test(t)) return 'nuit';
  if (/(aube|dawn|lever|petit matin)/.test(t)) return 'aube';
  if (/(cr[ée]puscule|coucher|dusk|golden|heure dor[ée]e|fin d.apr[eè]s-midi)/.test(t)) return 'heure_doree';
  return 'jour';
}

const SMALL_WORDS = new Set([
  'de',
  'du',
  'des',
  'la',
  'le',
  'les',
  'et',
  'à',
  'au',
  'aux',
  'en',
  'sur',
  'sous',
]);

/** « PORT DE LA GOULETTE » → « Port de la Goulette » (les en-têtes de scène sont en capitales). */
function cap(s: string): string {
  return s
    .toLowerCase()
    .split(/(\s+|-|')/)
    .map((w, i) =>
      (i > 0 && SMALL_WORDS.has(w)) || /^(\s+|-|')$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join('');
}

/** Extrait du texte d'une scène (1 200 caractères au plus) : précise les propositions de lieux. */
export function excerptOf(body: string[], max = 1200): string | undefined {
  const text = body
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
  if (!text) return undefined;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function parseScreenplayText(text: string): ParseScreenplayResult {
  const lines = text.split(/\r?\n/);
  type Draft = { heading: RegExpExecArray; body: string[] };
  const drafts: Draft[] = [];
  for (const line of lines) {
    const m = HEADING.exec(line);
    if (m) drafts.push({ heading: m, body: [] });
    else if (drafts.length) drafts[drafts.length - 1].body.push(line);
  }

  const locations = new Map<string, Location>();
  const allCharacters = new Set<string>();
  const scenes: Scene[] = drafts.map((d, i) => {
    const kind = d.heading[1].toUpperCase();
    const rest = d.heading[2];
    const [placeRaw, ...timeParts] = rest.split(/\s+[-–—]\s+/);
    const place = cap(placeRaw.replace(/[.]+$/, '').trim() || 'Lieu à préciser');
    const key = place.toLowerCase();
    if (!locations.has(key)) {
      locations.set(key, {
        id: uid('loc'),
        name: place,
        address: '',
        forbidden_days: [],
        permit: 'non_necessaire',
      });
    }
    const characters = new Set<string>();
    let summary = '';
    for (let j = 0; j < d.body.length; j++) {
      const l = d.body[j].trim();
      if (!l) continue;
      const isCue =
        /^[A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ' -]{1,24}(\s*\(.*\))?$/.test(l) &&
        l === l.toUpperCase() &&
        d.body[j + 1]?.trim();
      if (isCue) {
        const name = cap(l.replace(/\(.*\)/, '').trim());
        characters.add(name);
        allCharacters.add(name);
      } else if (!summary && !l.startsWith('(')) {
        summary = l.length > 140 ? `${l.slice(0, 137)}…` : l;
      }
    }
    const contentLines = d.body.filter((l) => l.trim()).length;
    const estimated = Math.max(0.5, Math.round((contentLines / 12) * 2) / 2);
    return {
      id: uid('sc'),
      number: String(i + 1),
      title: summary
        ? summary.split(/[.!?]/)[0].slice(0, 48)
        : `${kind.startsWith('EXT') ? 'Extérieur' : 'Intérieur'} ${place}`,
      setting: kind.startsWith('EXT') ? 'EXT' : 'INT',
      moment: momentFrom(timeParts.join(' ') || rest),
      location_id: locations.get(key)!.id,
      characters: [...characters],
      estimated_hours: estimated,
      summary,
      excerpt: excerptOf(d.body),
      source: 'import_ia',
      validated: false,
    };
  });

  const warnings: string[] = [];
  if (!scenes.length)
    warnings.push('Aucun en-tête de scène (INT. / EXT.) trouvé. Tu peux saisir les scènes à la main.');
  if (scenes.some((s) => !s.characters.length))
    warnings.push('Certaines scènes n’ont pas de personnage détecté : vérifie-les.');
  warnings.push('Les durées de tournage sont estimées à partir de la longueur du texte : ajuste-les.');
  return { scenes, locations: [...locations.values()], characters: [...allCharacters], warnings };
}

export async function mockParseScreenplay(input: ParseScreenplayInput): Promise<ParseScreenplayResult> {
  if (input.text?.trim()) return parseScreenplayText(input.text);
  if (input.file) {
    const name = input.file.name.toLowerCase();
    if (name.endsWith('.txt') || name.endsWith('.fountain'))
      return parseScreenplayText(await input.file.text());
    // PDF / DOCX : exemple de démonstration
    const demo = buildDemoProject();
    return {
      scenes: demo.scenes.map((s) => ({ ...s, source: 'import_ia', validated: false })),
      locations: demo.locations,
      characters: ['Amira', 'Slim', 'Mounir', 'Nour'],
      warnings: [
        'Mode démonstration : le contenu des fichiers PDF et DOCX n’est pas lu. Voici un exemple de découpage.',
        'Les durées de tournage sont estimées : ajuste-les.',
      ],
    };
  }
  return { scenes: [], locations: [], characters: [], warnings: ['Aucun scénario reçu.'] };
}
