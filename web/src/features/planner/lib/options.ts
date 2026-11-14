import type { SceneMoment } from '@/api/types';
import { MOMENT_ICONS, MOMENT_LABELS } from './labels';

export const MOMENT_OPTIONS = (['jour', 'aube', 'heure_doree', 'nuit'] as SceneMoment[]).map((m) => ({
  value: m,
  label: MOMENT_LABELS[m],
  icon: MOMENT_ICONS[m],
}));

export const SETTING_OPTIONS = [
  { value: 'INT' as const, label: 'INT · Intérieur' },
  { value: 'EXT' as const, label: 'EXT · Extérieur' },
];
