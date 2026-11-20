/**
 * Passeport IA dans Supabase (table ai_passports, une ligne par projet ; Passport.id = project_id).
 * Le navigateur n'écrit que film_title, director, declarations (migration 0007) : le code du badge
 * est créé par la base, et `c2pa_signed` n'est posé que par le serveur (vraie signature, à venir).
 * Vérification publique (/verifier/<code>) : fonction verify_badge, exécutable sans compte, qui ne
 * renvoie que les champs publics (titre, réalisation, déclarations, signature).
 */
import { formatISO } from 'date-fns';
import { z } from 'zod';
import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import { apiError, validate } from '../client';
import type { Api } from '../endpoints';
import { toAiTool } from '../aiTools';
import { checkPassportLocal, mockApi } from '../mocks/handlers';
import * as S from '../schemas';
import type * as T from '../types';
import { fromSupabase, unwrap } from './errors';
import { signedInClient } from './kit';

const COLUMNS = 'project_id, film_title, director, declarations, c2pa_signed, badge_code, updated_at';
const rowSchema = z.object({
  project_id: z.string(),
  film_title: z.string(),
  director: z.string(),
  declarations: z.array(S.departmentDeclarationSchema),
  c2pa_signed: z.boolean(),
  badge_code: z.string(),
  updated_at: z.string(),
});
const publicRowSchema = rowSchema.pick({
  film_title: true,
  director: true,
  declarations: true,
  c2pa_signed: true,
});

const verifyUrl = (code: string) =>
  `${env.publicAppUrl.replace(/\/$/, '')}/verifier/${encodeURIComponent(code)}`;

function toPassport(row: z.output<typeof rowSchema>): T.Passport {
  return {
    id: row.project_id,
    project_id: row.project_id,
    film_title: row.film_title,
    director: row.director,
    declarations: row.declarations,
    c2pa_signed: row.c2pa_signed,
    badge_code: row.badge_code,
    verify_url: verifyUrl(row.badge_code),
    updated_at: row.updated_at,
  };
}

async function load(projectId: string): Promise<T.Passport | null> {
  const sb = await signedInClient();
  const row = unwrap(await sb.from('ai_passports').select(COLUMNS).eq('project_id', projectId).maybeSingle());
  return row ? toPassport(validate(rowSchema, row, 'ai_passports')) : null;
}

async function requirePassport(id: string): Promise<T.Passport> {
  const p = await load(id);
  if (!p) throw apiError('introuvable', 404, 'Passeport introuvable.');
  return p;
}

const TOOL_COLUMNS =
  'slug, name, vendor, official_site, terms_url, status, review_state, research_state, note_fr, checked_at';

/**
 * Fiches des outils déclarés, lues dans le catalogue (lecture publique, sans compte : la page de
 * vérification est ouverte à tous les festivals). Une panne du catalogue ne casse pas la page :
 * les déclarations s'affichent sans le statut des outils.
 */
async function publicTools(slugs: string[]): Promise<T.AiTool[]> {
  if (!supabase || slugs.length === 0) return [];
  const res = await supabase.from('ai_tools').select(TOOL_COLUMNS).in('slug', slugs);
  if (res.error) return [];
  const parsed = z.array(S.catalogToolSchema).safeParse(res.data ?? []);
  return parsed.success ? parsed.data.map(toAiTool) : [];
}

/** Fonctions du Passeport servies par Supabase (remplacent celles du backend). */
export const supabasePassportApi: Pick<
  Api,
  'getProjectPassport' | 'savePassport' | 'checkPassport' | 'verifyPassport'
> = {
  getProjectPassport: (projectId) => load(projectId),

  async savePassport(input) {
    const sb = await signedInClient();
    const fields = {
      film_title: input.film_title,
      director: input.director,
      declarations: input.declarations,
    };
    const existing = await load(input.project_id);
    const res = existing
      ? await sb
          .from('ai_passports')
          .update(fields)
          .eq('project_id', input.project_id)
          .select(COLUMNS)
          .single()
      : await sb
          .from('ai_passports')
          .insert({ project_id: input.project_id, ...fields }) // badge_code : créé par la base
          .select(COLUMNS)
          .single();
    return toPassport(validate(rowSchema, unwrap(res), 'ai_passports'));
  },

  checkPassport: async (id) => checkPassportLocal(await requirePassport(id)),

  async verifyPassport(code) {
    // « exemple » : Passeport fictif de démonstration, jamais en base.
    if (code === 'exemple') return mockApi.verifyPassport(code);
    if (!supabase)
      throw apiError('serveur', 503, 'La vérification n’est pas disponible (base non configurée).');
    const res = await supabase.rpc('verify_badge', { code });
    if (res.error) throw fromSupabase(res.error, res.status);
    const rows = validate(z.array(publicRowSchema), res.data ?? [], 'verify_badge');
    const row = rows[0];
    if (!row) throw apiError('introuvable', 404, 'Aucun Passeport IA ne correspond à ce code.');
    const ids = new Set(row.declarations.map((d) => d.tool_id).filter(Boolean));
    const checked_at = formatISO(new Date());
    return {
      passport: {
        id: code,
        project_id: '',
        ...row,
        badge_code: code.toUpperCase(),
        verify_url: verifyUrl(code),
        updated_at: checked_at,
      },
      tools: await publicTools([...ids] as string[]),
      signature: { signed: row.c2pa_signed },
      checked_at,
    };
  },
};
