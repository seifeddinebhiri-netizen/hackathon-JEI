/**
 * PLANNING SIMULÉ — référence pour l'équipe backend (POST /planner/schedule).
 *
 * Entrée : le projet (scènes, lieux, période, heures max par jour) + la météo par jour.
 * Sortie : un `Schedule` au statut 'brouillon_ia'.
 *
 * Algorithme (glouton, déterministe) :
 *  1. Grouper les scènes par lieu. Les groupes avec le plus de scènes EXT passent en premier
 *     (ce sont les plus contraints par la météo).
 *  2. Pour chaque scène (EXT avant INT dans un groupe), noter chaque jour de la période :
 *       - éliminé si le lieu est interdit ce jour-là (date ISO ou jour de semaine) ;
 *       - éliminé si la scène dépasserait `max_hours_per_day` (somme des durées estimées) ;
 *       - éliminé si l'horaire imposé par le soleil (aube / heure dorée / nuit) tombe hors
 *         des horaires d'accès du lieu, ou si une autre scène occupe déjà ce même moment ;
 *       - EXT : éliminé si pluie ≥ 40 % ou vent ≥ 40 km/h prévus (1er passage) ;
 *       - bonus fort si le jour accueille déjà ce lieu (regroupement), malus si un autre lieu ;
 *       - EXT : bonus si la prévision est connue et sèche (plutôt qu'au-delà de l'horizon) ;
 *       - INT : bonus si le jour est pluvieux (on garde les jours secs pour l'EXT) ;
 *       - léger bonus aux jours les plus tôt.
 *     Le meilleur jour gagne.
 *  3. Si aucun jour ne passe, 2e passage sans le filtre météo : la scène est placée
 *     avec un conflit « pluie » ou « vent ». Si toujours rien : `unplaced` avec la raison.
 *  4. Chaque journée est mise en page par `layoutDay` (features/planner/lib/rules.ts) :
 *     horaires calés sur le soleil (suncalc), scènes « jour » à la suite dès 08:00,
 *     rendez-vous 1 h avant la 1re scène, conflits (pluie, vent, lieu fermé, journée trop longue,
 *     autorisation à demander, météo à revérifier au-delà de 14 jours).
 *  5. Note de repli : un jour avec des scènes EXT et une météo incertaine propose des scènes INT.
 *
 * La disponibilité des acteurs n'est PAS une contrainte dans cette version.
 */
import { eachDayOfInterval, formatISO, parseISO } from 'date-fns';
import type { Project, Scene, Schedule, ShootingDay, WeatherDay } from '@/api/types';
import { isoDay } from '@/lib/format';
import {
  anchoredSlot,
  atTime,
  isDry,
  isForbiddenDay,
  isRainy,
  isWeatherKnown,
  isWindy,
  layoutDay,
} from '@/features/planner/lib/rules';

type DayLoad = { date: string; sceneIds: string[]; hours: number; locations: Set<string>; moments: Set<string> };

export function mockSchedule(project: Project, weather: WeatherDay[]): Schedule {
  const dates = eachDayOfInterval({
    start: parseISO(project.shooting_window.from),
    end: parseISO(project.shooting_window.to),
  }).map(isoDay);
  const weatherBy = new Map(weather.map((w) => [w.date, w]));
  const locBy = new Map(project.locations.map((l) => [l.id, l]));
  const load = new Map<string, DayLoad>(
    dates.map((d) => [d, { date: d, sceneIds: [], hours: 0, locations: new Set(), moments: new Set() }]),
  );
  const unplaced: Schedule['unplaced'] = [];

  // 1. Groupes par lieu
  const groups = new Map<string, Scene[]>();
  for (const s of project.scenes) {
    const g = groups.get(s.location_id) ?? [];
    g.push(s);
    groups.set(s.location_id, g);
  }
  const extCount = (g: Scene[]) => g.filter((s) => s.setting === 'EXT').length;
  const orderedGroups = [...groups.values()].sort((a, b) => extCount(b) - extCount(a));

  const fits = (s: Scene, day: DayLoad, ignoreWeather: boolean): boolean => {
    const loc = locBy.get(s.location_id);
    const w = weatherBy.get(day.date);
    if (isForbiddenDay(loc, day.date)) return false;
    if (day.hours + s.estimated_hours > project.max_hours_per_day) return false;
    if (s.moment !== 'jour' && day.moments.has(s.moment)) return false;
    const anchored = anchoredSlot(s, day.date, loc);
    if (anchored && loc?.access_hours) {
      if (anchored.start < atTime(day.date, loc.access_hours.from)) return false;
      if (anchored.end > atTime(day.date, loc.access_hours.to)) return false;
    }
    if (!ignoreWeather && s.setting === 'EXT' && (isRainy(w) || isWindy(w))) return false;
    return true;
  };

  const score = (s: Scene, day: DayLoad, index: number): number => {
    const w = weatherBy.get(day.date);
    let n = 0;
    if (day.locations.has(s.location_id)) n += 10;
    else if (day.locations.size > 0) n -= 5;
    if (s.setting === 'EXT' && isDry(w)) n += 4;
    if (s.setting === 'INT' && isRainy(w)) n += 3;
    if (s.setting === 'INT' && isDry(w) && day.locations.size === 0) n -= 1;
    return n - index * 0.05;
  };

  // 2-3. Placement
  for (const group of orderedGroups) {
    const scenes = [...group].sort((a, b) =>
      a.setting === b.setting ? a.number.localeCompare(b.number, 'fr', { numeric: true }) : a.setting === 'EXT' ? -1 : 1,
    );
    for (const s of scenes) {
      let best: DayLoad | undefined;
      for (const ignoreWeather of [false, true]) {
        let bestScore = -Infinity;
        dates.forEach((d, i) => {
          const day = load.get(d)!;
          if (!fits(s, day, ignoreWeather)) return;
          const sc = score(s, day, i);
          if (sc > bestScore) {
            bestScore = sc;
            best = day;
          }
        });
        if (best) break;
      }
      if (!best) {
        unplaced.push({ scene_id: s.id, reason: unplacedReason(s, project, dates) });
        continue;
      }
      best.sceneIds.push(s.id);
      best.hours += s.estimated_hours;
      best.locations.add(s.location_id);
      if (s.moment !== 'jour') best.moments.add(s.moment);
    }
  }

  // 4-5. Mise en page
  const sceneBy = new Map(project.scenes.map((s) => [s.id, s]));
  const days: ShootingDay[] = [...load.values()]
    .filter((d) => d.sceneIds.length > 0)
    .map((d) => {
      const sceneIds = [...d.sceneIds].sort((a, b) =>
        sceneBy.get(a)!.number.localeCompare(sceneBy.get(b)!.number, 'fr', { numeric: true }),
      );
      const w = weatherBy.get(d.date);
      return layoutDay({
        dateIso: d.date,
        sceneIds,
        project,
        weather: w,
        backup_note: backupNote(sceneIds, w, project, d),
      });
    });

  return { generated_at: formatISO(new Date()), status: 'brouillon_ia', days, unplaced };
}

function backupNote(sceneIds: string[], w: WeatherDay | undefined, project: Project, day: DayLoad): string | undefined {
  const scenes = sceneIds.map((id) => project.scenes.find((s) => s.id === id)!);
  if (!scenes.some((s) => s.setting === 'EXT')) return undefined;
  const intElsewhere = project.scenes.filter((s) => s.setting === 'INT' && !sceneIds.includes(s.id));
  const sameLocInt = intElsewhere.filter((s) => day.locations.has(s.location_id));
  const candidates = (sameLocInt.length ? sameLocInt : intElsewhere).slice(0, 2);
  const list = candidates.map((s) => `scène ${s.number}`).join(', ');
  if (!isWeatherKnown(w)) {
    return candidates.length
      ? `Météo pas encore connue : garder en repli une scène intérieure (${list}).`
      : 'Météo pas encore connue : prévoir une solution de repli.';
  }
  if (w.rain_pct >= 25 || w.wind_kmh >= 30) {
    return candidates.length
      ? `Risque d'averse (${w.rain_pct} %) : repli possible sur ${list}.`
      : `Risque d'averse (${w.rain_pct} %) : prévoir une bâche ou un abri.`;
  }
  return undefined;
}

function unplacedReason(s: Scene, project: Project, dates: string[]): string {
  const loc = project.locations.find((l) => l.id === s.location_id);
  if (!loc) return 'Lieu inconnu : associe un lieu à cette scène.';
  if (dates.every((d) => isForbiddenDay(loc, d))) return `${loc.name} est fermé sur toute la période.`;
  if (s.estimated_hours > project.max_hours_per_day)
    return `La scène dure plus que le maximum de ${project.max_hours_per_day} h par jour.`;
  const anyAnchored = dates.some((d) => {
    const a = anchoredSlot(s, d, loc);
    return !a || !loc.access_hours || a.end <= atTime(d, loc.access_hours.to);
  });
  if (!anyAnchored) return `Le moment voulu tombe hors des horaires d'accès de ${loc.name}.`;
  return 'Plus de place dans la période : allonge la période ou les heures par jour.';
}
