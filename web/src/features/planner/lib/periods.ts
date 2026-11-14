import { addDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';

export function weekLabel(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  return `${format(weekStart, 'd MMM', { locale: fr })} – ${format(end, 'd MMM yyyy', { locale: fr })}`;
}
export function monthLabel(month: Date): string {
  return format(month, 'MMMM yyyy', { locale: fr });
}
