/**
 * Kit Festival dans Supabase (migration backend/migrations/0005_kit_festival.sql) :
 * festival_dossiers, kit_pieces, film_kits. Accès direct avec la clé publique ; la sécurité par
 * ligne limite chaque compte à ses lignes. owner_id prend le défaut auth.uid() de la base.
 */
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { apiError, validate } from '../client';
import type { KitApi } from '../kit';
import * as S from '../schemas';
import type * as T from '../types';
import { unwrap } from './errors';

const FILM_COLUMNS =
  'duration_min, language, genre, synopsis_phrase, synopsis_court, synopsis_long, synopsis_en, stills, trailer_url';

const dossierRowSchema = z.object({
  festival_id: z.string(),
  status: z.enum(['a_preparer', 'pret', 'soumis', 'reponse_recue', 'prochain_appel']),
  ai_choice: S.aiChoiceSchema.nullable(),
});
const pieceRowSchema = z.object({ piece_key: z.string(), state: S.kitPieceStateSchema });
const filmRowSchema = z.object({
  duration_min: z.number().nullable(),
  language: z.string().nullable(),
  genre: z.string().nullable(),
  synopsis_phrase: z.string(),
  synopsis_court: z.string(),
  synopsis_long: z.string(),
  synopsis_en: z.unknown(),
  stills: z.array(z.string()),
  trailer_url: z.string().nullable(),
});
type FilmRow = z.output<typeof filmRowSchema>;

/** Client connecté : le Kit Festival exige un compte. */
export async function signedInClient(): Promise<SupabaseClient> {
  if (!supabase)
    throw apiError(
      'serveur',
      503,
      'Le Kit Festival n’est pas relié à la base : renseigne VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.',
    );
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw apiError('non_autorise', 401, 'Connecte-toi pour utiliser le Kit Festival.');
  return supabase;
}

function toItem(row: z.output<typeof dossierRowSchema>): T.ShortlistItem {
  return { festival_id: row.festival_id, status: row.status, ai_choice: row.ai_choice };
}

/** Ligne film_kits → champs du Kit (absents tant que rien n'est enregistré). */
export function filmFromRow(row: FilmRow | null): T.KitFilmFields {
  if (!row) return {};
  const en = S.kitFilmFieldsSchema.safeParse({ synopsis_en: row.synopsis_en });
  return {
    film_profile:
      row.duration_min === null
        ? undefined
        : { duration_min: row.duration_min, language: row.language ?? '', genre: row.genre ?? '' },
    synopsis: { phrase: row.synopsis_phrase, court: row.synopsis_court, long: row.synopsis_long },
    film_page: { stills: row.stills, ...(row.trailer_url ? { trailer_url: row.trailer_url } : {}) },
    synopsis_en: en.success ? en.data.synopsis_en : undefined,
  };
}

/** Champs envoyés → colonnes film_kits (seulement celles des champs envoyés). */
export function filmToRow(patch: T.KitFilmFields): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.film_profile) {
    row.duration_min = Math.round(patch.film_profile.duration_min) || null;
    row.language = patch.film_profile.language;
    row.genre = patch.film_profile.genre;
  }
  if (patch.synopsis) {
    row.synopsis_phrase = patch.synopsis.phrase;
    row.synopsis_court = patch.synopsis.court;
    row.synopsis_long = patch.synopsis.long;
  }
  if (patch.film_page) {
    row.stills = patch.film_page.stills;
    row.trailer_url = patch.film_page.trailer_url || null;
  }
  if (patch.synopsis_en) row.synopsis_en = patch.synopsis_en;
  return row;
}

export const supabaseKitApi: KitApi = {
  async getKit(projectId) {
    const sb = await signedInClient();
    const [dossiers, pieces, film] = await Promise.all([
      sb
        .from('festival_dossiers')
        .select('festival_id, status, ai_choice')
        .eq('project_id', projectId)
        .order('position')
        .order('created_at'),
      sb.from('kit_pieces').select('piece_key, state').eq('project_id', projectId),
      sb.from('film_kits').select(FILM_COLUMNS).eq('project_id', projectId).maybeSingle(),
    ]);
    const d = validate(z.array(dossierRowSchema), unwrap(dossiers), 'festival_dossiers');
    const p = validate(z.array(pieceRowSchema), unwrap(pieces), 'kit_pieces');
    const f = validate(filmRowSchema.nullable(), unwrap(film), 'film_kits');
    return {
      project_id: projectId,
      dossiers: d.map(toItem),
      pieces: Object.fromEntries(p.map((r) => [r.piece_key, r.state])),
      ...filmFromRow(f),
    };
  },

  async addDossier(projectId, item) {
    const sb = await signedInClient();
    const last = unwrap(
      await sb
        .from('festival_dossiers')
        .select('position')
        .eq('project_id', projectId)
        .order('position', { ascending: false })
        .limit(1),
    ) as { position: number }[];
    unwrap(
      await sb.from('festival_dossiers').upsert(
        {
          project_id: projectId,
          festival_id: item.festival_id,
          status: item.status,
          ai_choice: item.ai_choice ?? null,
          position: (last[0]?.position ?? -1) + 1,
        },
        { onConflict: 'project_id,festival_id', ignoreDuplicates: true },
      ),
    );
    return item;
  },

  async updateDossier(projectId, item) {
    const sb = await signedInClient();
    const row = unwrap(
      await sb
        .from('festival_dossiers')
        .update({ status: item.status, ai_choice: item.ai_choice ?? null })
        .eq('project_id', projectId)
        .eq('festival_id', item.festival_id)
        .select('festival_id, status, ai_choice')
        .maybeSingle(),
    );
    if (!row) throw apiError('introuvable', 404, 'Ce dossier n’existe plus.');
    return toItem(validate(dossierRowSchema, row, 'festival_dossiers'));
  },

  async removeDossier(projectId, festivalId) {
    const sb = await signedInClient();
    unwrap(
      await sb.from('festival_dossiers').delete().eq('project_id', projectId).eq('festival_id', festivalId),
    );
  },

  async setPiece(projectId, key, state) {
    const sb = await signedInClient();
    unwrap(
      await sb
        .from('kit_pieces')
        .upsert({ project_id: projectId, piece_key: key, state }, { onConflict: 'project_id,piece_key' }),
    );
  },

  async saveFilm(projectId, patch) {
    const sb = await signedInClient();
    const row = unwrap(
      await sb
        .from('film_kits')
        .upsert({ project_id: projectId, ...filmToRow(patch) }, { onConflict: 'project_id' })
        .select(FILM_COLUMNS)
        .single(),
    );
    return filmFromRow(validate(filmRowSchema, row, 'film_kits'));
  },
};
