import type { Festival, ShortlistItem } from '@/api/types';

/** Dossier à préparer : une ligne par exigence du festival (la déclaration IA s'ajoute si le festival la demande). */
export function buildShortlistItem(f: Festival): ShortlistItem {
  return {
    festival_id: f.id,
    status: 'a_preparer',
    checklist: f.requirements.map((requirement) => ({ requirement, done: false })),
  };
}

export function progress(item: ShortlistItem): number {
  if (!item.checklist.length) return 100;
  return Math.round((item.checklist.filter((c) => c.done).length / item.checklist.length) * 100);
}

/** Festival affichable seulement s'il a une source officielle et une date de vérification. */
export function isVerified(f: Festival): boolean {
  return !!f.source_url.trim() && !!f.checked_at.trim();
}
