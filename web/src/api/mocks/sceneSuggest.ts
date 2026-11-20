/**
 * Suggestions de tournage : version SIMULÉE de POST /planner/scenes/suggest.
 * Règles simples et déterministes qui lisent le texte des scènes, comme le ferait le modèle :
 * jamais d'écriture, seulement des précisions ou des simplifications de tournage.
 */
import type { SceneSuggestInput, SceneSuggestion, SceneSuggestResult } from '../types';

type In = SceneSuggestInput['scenes'][number];

const textOf = (s: In) => `${s.title} ${s.summary} ${s.excerpt ?? ''}`.toLowerCase();

const EXTERIOR = /\b(rue|ruelle|plage|mer|jardin|terrasse|route|place|dehors)\b/;
const INTERIOR = /\b(chambre|cuisine|salon|appartement|bureau|couloir)\b/;

function momentHint(s: In): { moment: In['moment']; quote: string } | null {
  const t = textOf(s);
  const m = /coucher du soleil|crépuscule|soleil se couche|fin de journée/.exec(t) ?? null;
  if (m && s.moment !== 'heure_doree') return { moment: 'heure_doree', quote: m[0] };
  const dawn = /lever du jour|lever du soleil|petit matin|à l’aube|à l'aube/.exec(t);
  if (dawn && s.moment !== 'aube') return { moment: 'aube', quote: dawn[0] };
  const night = /\b(nuit|lampes|obscurité|minuit)\b/.exec(t);
  if (night && s.moment === 'jour') return { moment: 'nuit', quote: night[0] };
  return null;
}

/** Mot significatif commun à deux noms de décor (« café » dans « Médina : ruelle et café » et « Petit café »). */
function sharedWord(a: string, b: string): string | null {
  const words = (x: string) =>
    new Set(
      x
        .toLowerCase()
        .split(/[^a-zàâçéèêëîïôûùüÿœ’']+/)
        .filter((w) => w.length > 3 && !['tunis', 'avec', 'dans'].includes(w)),
    );
  const wb = words(b);
  return [...words(a)].find((w) => wb.has(w)) ?? null;
}

export function mockSuggestScenes(input: SceneSuggestInput): SceneSuggestResult {
  const out: Omit<SceneSuggestion, 'id'>[] = [];
  const base = { change_setting: null, change_moment: null, change_decor: null };

  for (const s of input.scenes) {
    const t = textOf(s);
    const ext = EXTERIOR.exec(t);
    const int = INTERIOR.exec(t);
    if (s.setting === 'INT' && ext && !int)
      out.push({
        ...base,
        scene_numbers: [s.number],
        kind: 'preciser_int_ext',
        message: `Le texte se passe plutôt dehors (« ${ext[0]} ») : la scène est-elle en extérieur ?`,
        source: ext[0],
        change_setting: 'EXT',
      });
    else if (s.setting === 'EXT' && int && !ext)
      out.push({
        ...base,
        scene_numbers: [s.number],
        kind: 'preciser_int_ext',
        message: `Le texte se passe plutôt à l’intérieur (« ${int[0]} ») : la scène est-elle en intérieur ?`,
        source: int[0],
        change_setting: 'INT',
      });

    const hint = momentHint(s);
    if (hint)
      out.push({
        ...base,
        scene_numbers: [s.number],
        kind: 'preciser_moment',
        message:
          hint.moment === 'heure_doree'
            ? 'Le texte parle de la fin de journée : tourner en lumière du soir collerait mieux.'
            : hint.moment === 'aube'
              ? 'Le texte parle du lever du jour : tourner au lever du soleil collerait mieux.'
              : 'Le texte se passe la nuit, mais la scène est prévue de jour.',
        source: hint.quote,
        change_moment: hint.moment,
      });

    if (s.setting === 'EXT' && s.moment === 'nuit')
      out.push({
        ...base,
        scene_numbers: [s.number],
        kind: 'alleger_scene',
        message:
          'Une scène de nuit en extérieur demande de l’éclairage et une équipe tard le soir. Tu peux la tourner juste après le coucher du soleil, quand il reste un peu de lumière : elle racontera la même chose.',
        source: s.summary || s.title,
      });

    // Le texte parle d'un autre décor du film : le décor de la scène est-il le bon ?
    const other = input.decors.find((d) => d !== s.decor && sharedWord(d, `${s.title} ${s.summary}`));
    if (other && s.decor) {
      const w = sharedWord(other, `${s.title} ${s.summary}`)!;
      out.push({
        ...base,
        scene_numbers: [s.number],
        kind: 'info_manquante',
        message: `Le texte parle du ${w}, mais la scène est prévue dans « ${s.decor} ». Vérifie le décor : si elle se passe au ${w}, tu peux la tourner le même jour que les autres scènes de « ${other} ».`,
        source: s.summary || s.title,
      });
    }

    if (!s.characters.length)
      out.push({
        ...base,
        scene_numbers: [s.number],
        kind: 'info_manquante',
        message:
          'Aucun personnage n’est indiqué : précise qui joue dans cette scène pour prévoir les acteurs.',
        source: s.title || `Scène ${s.number}`,
      });
  }

  // Deux décors qui partagent un mot : sans doute le même endroit
  const decors = input.decors.filter((d) => d.trim());
  for (let i = 0; i < decors.length; i++)
    for (let j = i + 1; j < decors.length; j++) {
      const w = sharedWord(decors[i], decors[j]);
      if (!w) continue;
      const [keep, move] = [decors[i], decors[j]];
      const scenes = input.scenes.filter((s) => s.decor === move).map((s) => s.number);
      if (!scenes.length) continue;
      out.push({
        ...base,
        scene_numbers: scenes,
        kind: 'regrouper_decors',
        message: `« ${move} » et « ${keep} » parlent tous deux d’un ${w} : un seul lieu peut servir pour les deux, une journée de déplacement en moins.`,
        source: `${keep} / ${move}`,
        change_decor: keep,
      });
    }

  return {
    status: 'Brouillon IA : à valider',
    suggestions: out.slice(0, 12).map((s, i) => ({ ...s, id: `sug-${i + 1}` })),
    model: 'simulation',
  };
}
