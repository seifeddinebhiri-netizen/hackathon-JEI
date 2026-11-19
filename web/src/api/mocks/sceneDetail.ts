/**
 * Fiche de tournage simulée (mode démo) : tirée uniquement du texte de la scène, comme le vrai
 * service. Ce qui n'apparaît pas dans le texte reste vide.
 */
import type { SceneDetail, SceneDetailInput } from '../types';

const PROPS = [
  'téléphone',
  'enveloppe',
  'lettre',
  'clé',
  'clés',
  'valise',
  'sac',
  'verre',
  'tasse',
  'café',
  'cigarette',
  'couteau',
  'frigo',
  'machine à café',
  'rideau de fer',
  'photo',
  'carnet',
  'livre',
  'ordinateur',
  'radio',
  'télévision',
];
const SPECIAL = [
  'voiture',
  'scooter',
  'moto',
  'bus',
  'taxi',
  'bateau',
  'vélo',
  'chien',
  'chat',
  'cheval',
  'pluie',
  'feu',
  'fumée',
];
const SOUND = [
  'musique',
  'radio',
  'klaxon',
  'cris',
  'chant',
  'appel à la prière',
  'vagues',
  'vent',
  'sonnerie',
];
const COSTUMES = [
  'robe',
  'costume',
  'uniforme',
  'tablier',
  'voile',
  'foulard',
  'veste',
  'maquillage',
  'chéchia',
  'jebba',
];
const EXTRAS = /\b(foule|passants?|clients?|figurants?|voisins?|élèves|marchands?|policiers?)\b/i;

function found(text: string, words: string[]): string[] {
  const t = text.toLowerCase();
  return words
    .filter((w) => new RegExp(`(^|[^\\p{L}])${w}([^\\p{L}]|$)`, 'u').test(t))
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1));
}

function sentences(text: string, max: number): string {
  return (text.match(/[^.!?…]+[.!?…]+/g) ?? [text])
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max)
    .join(' ');
}

export function mockDetailScene(input: SceneDetailInput): SceneDetail {
  const { scene } = input;
  const text = `${scene.summary} ${scene.excerpt ?? ''}`;
  const extras = text.match(EXTRAS)?.[0] ?? '';
  const watch_out: string[] = [];
  if (scene.moment === 'nuit')
    watch_out.push(
      scene.setting === 'EXT'
        ? 'Extérieur de nuit : prévois de la lumière et une autorisation.'
        : 'Scène de nuit : vérifie que la lumière du décor suffit.',
    );
  if (scene.moment === 'aube' || scene.moment === 'heure_doree')
    watch_out.push('Lumière courte : tout doit être prêt avant le lever ou le coucher du soleil.');
  if (scene.setting === 'EXT')
    watch_out.push('Extérieur : repère le bruit ambiant et prévois une solution en cas de pluie.');
  if (scene.characters.length > 2)
    watch_out.push(`${scene.characters.length} personnages : prévois le temps de placer tout le monde.`);
  if (extras) watch_out.push('Des figurants sont mentionnés : confirme leur nombre et leur venue.');
  return {
    what_happens: sentences(scene.excerpt || scene.summary || scene.title, 4) || scene.title,
    on_screen: scene.decor ? `${scene.setting === 'INT' ? 'Intérieur' : 'Extérieur'} : ${scene.decor}.` : '',
    props: found(text, PROPS),
    costumes: found(text, COSTUMES),
    extras: extras ? `${extras.charAt(0).toUpperCase()}${extras.slice(1)} mentionnés dans le texte.` : '',
    sound: found(text, SOUND),
    special: found(text, SPECIAL),
    watch_out: watch_out.slice(0, 4),
    model: 'démo',
  };
}
