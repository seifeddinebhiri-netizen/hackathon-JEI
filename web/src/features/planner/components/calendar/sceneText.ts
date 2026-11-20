import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Location, Scene, ScheduledScene } from '@/api/types';
import { formatHourFr, formatHours } from '@/lib/format';
import { MOMENT_SCRIPT } from '../../lib/labels';

/** « 8 h 00 – 11 h 15 » */
export function timeRange(s: Pick<ScheduledScene, 'start' | 'end'>): string {
  return `${formatHourFr(s.start)} – ${formatHourFr(s.end)}`;
}

/** Durée d'une scène planifiée, en heures décimales. */
export function scheduledHours(s: Pick<ScheduledScene, 'start' | 'end'>): number {
  return (parseISO(s.end).getTime() - parseISO(s.start).getTime()) / 3_600_000;
}

/** « 3 h 15 », « 4 h », « 45 min » */
export function durationText(s: Pick<ScheduledScene, 'start' | 'end'>): string {
  return formatHours(scheduledHours(s));
}

const titleOf = (scene: Scene) => scene.title.trim() || 'Sans titre';

/** En-tête au format script : « Scène 1 — INT. AMIRA OUVRE LE CAFÉ — JOUR » */
export function sceneHeading(scene: Scene): string {
  return `Scène ${scene.number} — ${scene.setting}. ${titleOf(scene).toLocaleUpperCase('fr')} — ${MOMENT_SCRIPT[
    scene.moment
  ].toLocaleUpperCase('fr')}`;
}

/** Même en-tête en casse normale, pour la liste du scénario : « 2. Ext. Course dans les ruelles — jour » */
export function sceneHeadingPlain(scene: Scene): string {
  const setting = scene.setting === 'INT' ? 'Int.' : 'Ext.';
  return `${scene.number}. ${setting} ${titleOf(scene)} — ${MOMENT_SCRIPT[scene.moment]}`;
}

/** Nom court du lieu : ce qui précède « : », « , » ou « ( » (« Médina : ruelle et café » → « Médina »). */
export function shortPlace(location: Pick<Location, 'name'> | undefined): string {
  return location?.name.split(/[:,(]/)[0].trim() ?? '';
}

/** Texte du bloc sur la frise : « Sc. 1 · Médina », ou seulement « Sc. 1 » s'il ne tient pas. */
export function blockLabels(scene: Scene, location: Pick<Location, 'name'> | undefined) {
  const short = `Sc. ${scene.number}`;
  const place = shortPlace(location);
  return { full: place ? `${short} · ${place}` : short, short };
}

/** « Jour 2, mar. 24 nov. » */
export function dayShortLabel(date: string, index: number): string {
  return `Jour ${index + 1}, ${format(parseISO(date), 'EEE d MMM', { locale: fr })}`;
}

/** Texte complet d'une scène (annonces du glisser-déposer, aria-label) : « Scène 1, INT, Amira ouvre le café, 8 h 00 – 10 h 00 » */
export function sceneLine(scene: Scene, scheduled?: ScheduledScene): string {
  const parts = [`Scène ${scene.number}`, scene.setting, titleOf(scene)];
  if (scheduled) parts.push(timeRange(scheduled));
  return parts.join(', ');
}
