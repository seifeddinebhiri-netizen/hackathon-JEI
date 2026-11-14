import { format, parseISO, differenceInCalendarDays, formatDistanceToNowStrict } from 'date-fns';
import { fr } from 'date-fns/locale';

/** "2026-11-20" ou ISO complet → Date locale. */
export function toDate(value: string | Date): Date {
  return value instanceof Date ? value : parseISO(value);
}

/** jeudi 20 novembre */
export function formatDayLong(value: string | Date): string {
  return format(toDate(value), 'EEEE d MMMM', { locale: fr });
}
/** jeu. 20 nov. */
export function formatDayShort(value: string | Date): string {
  return format(toDate(value), 'EEE d MMM', { locale: fr });
}
/** 20 novembre 2026 */
export function formatDate(value: string | Date): string {
  return format(toDate(value), 'd MMMM yyyy', { locale: fr });
}
/** 20/11/2026 */
export function formatDateNumeric(value: string | Date): string {
  return format(toDate(value), 'dd/MM/yyyy', { locale: fr });
}
/** 07 h 42 */
export function formatTime(value: string | Date): string {
  return format(toDate(value), "HH 'h' mm", { locale: fr });
}
/** yyyy-MM-dd */
export function isoDay(value: Date): string {
  return format(value, 'yyyy-MM-dd');
}

export function daysUntil(value: string | Date, now: Date = new Date()): number {
  return differenceInCalendarDays(toDate(value), now);
}

export function relative(value: string | Date): string {
  return formatDistanceToNowStrict(toDate(value), { locale: fr, addSuffix: true });
}

export function formatHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} min`;
  const whole = Math.floor(h);
  const min = Math.round((h - whole) * 60);
  return min ? `${whole} h ${String(min).padStart(2, '0')}` : `${whole} h`;
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n > 1 ? many : one}`;
}
