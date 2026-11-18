/** Petites fonctions d'affichage partagées par les écrans du Kit Festival. */
import type { Festival, Passport } from '@/api/types';
import { formatDate } from '@/lib/format';

/** Nombre de départements avec IA dans le Passeport (0 si pas encore de Passeport). */
export function aiDepartments(p: Passport | null | undefined): number {
  return p?.declarations.filter((d) => d.used_ai).length ?? 0;
}

/** Nom court d'un festival : sigle entre parenthèses (« JCC », « BSFF »), sinon la partie avant « · ». */
export function shortName(f: Festival): string {
  const sigle = /\(([A-Z][A-Z0-9-]{1,11})\)/.exec(f.name)?.[1];
  if (sigle) return sigle;
  return f.name.split(' · ')[0].trim();
}

export function deadlineText(f: Festival): string {
  if (!f.deadline) return 'À confirmer';
  return f.deadline_status === 'passee' ? `Close le ${formatDate(f.deadline)}` : formatDate(f.deadline);
}

/** Valeur « [non précisé] » du règlement → texte lisible. */
export function feeText(fee: string): string {
  return /^\[.*\]$/.test(fee.trim()) ? 'Non précisé' : fee;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
