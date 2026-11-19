/**
 * Page film publique (/film/<id du projet>) : fonction public_film, exécutable sans compte, qui ne
 * renvoie que les champs publics (titre, réalisation, synopsis, photos, générique sans contacts,
 * bande-annonce, code du Passeport IA). Le film doit avoir une page préparée (film_kits).
 */
import { z } from 'zod';
import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import { apiError, validate } from '../client';
import type * as T from '../types';
import { fromSupabase } from './errors';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const rowSchema = z.object({
  title: z.string(),
  director: z.string(),
  synopsis_short: z.string(),
  synopsis_long: z.string(),
  stills: z.array(z.string()),
  credits: z.array(z.object({ role: z.string(), name: z.string() })),
  trailer_url: z.string().nullable(),
  passport_badge_code: z.string().nullable(),
});

const notFound = () => apiError('introuvable', 404, 'Aucun film ne correspond à ce lien.');

export async function getPublicFilm(id: string): Promise<T.PublicFilm> {
  if (!UUID.test(id)) throw notFound(); // la base refuserait l'identifiant : inutile de l'appeler
  if (!supabase) throw apiError('serveur', 503, 'La page film n’est pas disponible (base non configurée).');
  const res = await supabase.rpc('public_film', { film_id: id });
  if (res.error) {
    if (res.error.code === 'PGRST202')
      throw apiError(
        'serveur',
        503,
        'La page film n’est pas encore publiée : la migration 0008 n’est pas appliquée.',
      );
    throw fromSupabase(res.error, res.status);
  }
  const row = validate(z.array(rowSchema), res.data ?? [], 'public_film')[0];
  if (!row) throw notFound();
  const code = row.passport_badge_code ?? undefined;
  return {
    id,
    title: row.title,
    director: row.director,
    synopsis_short: row.synopsis_short,
    synopsis_long: row.synopsis_long,
    stills: row.stills,
    credits: row.credits,
    ...(row.trailer_url ? { trailer_url: row.trailer_url } : {}),
    ...(code
      ? {
          passport_badge_code: code,
          verify_url: `${env.publicAppUrl.replace(/\/$/, '')}/verifier/${encodeURIComponent(code)}`,
        }
      : {}),
  };
}
