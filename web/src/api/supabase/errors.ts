/**
 * Erreurs Supabase (PostgREST, Auth, réseau) → ApiError avec un message en français.
 * Le message technique d'origine (en anglais) n'est jamais affiché.
 */
import { apiError, type ApiError } from '../client';

type SbError = { code?: string; message?: string; status?: number } | null | undefined;

export function fromSupabase(error: SbError, status = 0): ApiError {
  const code = error?.code ?? '';
  const msg = error?.message ?? '';
  if (/failed to fetch|networkerror|fetch failed|load failed/i.test(msg))
    return apiError('reseau', 0, 'Impossible de joindre la base de données. Vérifie ta connexion.');
  if (code === 'PGRST301' || code === 'PGRST303' || status === 401) return apiError('non_autorise', 401);
  if (code === '42501' || status === 403)
    return apiError(
      'interdit',
      403,
      'Tu n’as pas accès à ces données (elles appartiennent à un autre compte).',
    );
  if (code === 'PGRST116') return apiError('introuvable', 404);
  if (code === '23505') return apiError('conflit', 409, 'Cet élément existe déjà.');
  if (code === '23503')
    return apiError('invalide', 422, 'Élément lié introuvable : le festival ou le projet n’existe plus.');
  if (code === '23514' || code === '22P02' || code === '22001')
    return apiError('invalide', 422, 'Certaines informations ne respectent pas le format attendu.');
  if (code === '42P01' || code === 'PGRST205' || code === '42883')
    return apiError(
      'serveur',
      503,
      'La base de données n’est pas à jour : la migration 0005 du Kit Festival n’est pas appliquée.',
    );
  return apiError(
    'serveur',
    status >= 500 ? status : 503,
    'La base de données a rencontré un problème. Réessaie dans un instant.',
  );
}

/** Résultat Supabase → données, ou ApiError en français. */
export function unwrap<T>(res: { data: T; error: SbError; status?: number }): T {
  if (res.error) throw fromSupabase(res.error, res.status);
  return res.data;
}
