/**
 * Ce que la météo de la période implique pour un décor : bons jours, jours à risque, jours pas
 * encore prévus, et une phrase simple. Ne s'applique qu'aux scènes en extérieur.
 */
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { WeatherDay } from '@/api/types';
import { isRainy, isWeatherKnown, isWindy } from '../../lib/rules';

/** Contrainte envoyée aux propositions de lieux quand la météo menace les scènes en extérieur. */
export const SHELTER_CONSTRAINT =
  'pluie ou vent fort probables pendant la période de tournage : préférer des lieux abrités ou un intérieur qui convient aux scènes';

export type WeatherVerdict = {
  good: WeatherDay[];
  bad: WeatherDay[];
  unknown: WeatherDay[];
  sentence: string;
  /** Proposer d'autres lieux (abrités) et d'autres jours */
  needsAlternatives: boolean;
};

const short = (d: WeatherDay) => format(parseISO(d.date), 'EEE d MMM', { locale: fr });
const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

/** « lun. 23 nov., mar. 24 nov. » ou « … et 2 autres jours » (au plus 4 dates citées). */
function dayList(days: WeatherDay[]): string {
  const shown = days.slice(0, 4).map(short).join(', ');
  return days.length > 4
    ? `${shown} et ${plural(days.length - 4, 'autre')} jour${days.length > 5 ? 's' : ''}`
    : shown;
}

/** Termine une phrase par un point, sans doubler celui d'une abréviation (« nov. »). */
const endSentence = (t: string) => (t.endsWith('.') ? t : `${t}.`);

export function weatherVerdict(days: WeatherDay[], hasExterior: boolean): WeatherVerdict {
  const known = days.filter((d) => isWeatherKnown(d));
  const bad = known.filter((d) => isRainy(d) || isWindy(d));
  const good = known.filter((d) => !bad.includes(d));
  const unknown = days.filter((d) => !isWeatherKnown(d));
  const later = unknown.length
    ? ` Pour ${unknown.length > 1 ? `les ${unknown.length} autres jours` : 'l’autre jour'}, la prévision arrive environ deux semaines avant.`
    : '';

  let sentence: string;
  if (!hasExterior)
    sentence = bad.length
      ? `Pluie ou vent prévus ${plural(bad.length, 'jour')}, mais tout est en intérieur dans ce décor : pas de gêne.`
      : 'Tout est en intérieur dans ce décor : la météo ne gêne pas le tournage.';
  else if (!known.length)
    sentence =
      'La météo n’est pas encore connue pour ta période : elle s’affiche environ deux semaines avant.';
  else if (!bad.length)
    sentence = `Temps sec prévu ${known.length > 1 ? `les ${known.length} jours connus` : 'le jour connu'} : bon pour les scènes en extérieur.${later}`;
  else
    sentence =
      `Pluie ou vent fort prévus ${plural(bad.length, 'jour')} sur ${known.length}. ` +
      (good.length
        ? endSentence(`Meilleurs jours pour les scènes en extérieur : ${dayList(good)}`)
        : 'Aucun jour sec dans les prévisions : regarde des lieux abrités.') +
      later;

  return { good, bad, unknown, sentence, needsAlternatives: hasExterior && bad.length > 0 };
}
