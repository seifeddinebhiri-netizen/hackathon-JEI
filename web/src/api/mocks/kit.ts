/** Kit Festival simulé (VITE_USE_MOCKS=true) : même interface que supabase/kit.ts. */
import type { KitApi } from '../kit';
import * as S from '../schemas';
import type * as T from '../types';
import { apiError } from '../client';
import { getDb, persist } from './db';
import { requireProject, simulate } from './handlers';

function kitOf(id: string): T.KitData {
  const p = requireProject(id);
  const db = getDb();
  return {
    project_id: id,
    dossiers: p.festival_shortlist.map((d) => ({
      festival_id: d.festival_id,
      status: d.status,
      ai_choice: d.ai_choice ?? null,
    })),
    pieces: { ...(db.pieces[id] ?? {}) },
    film_profile: p.film_profile,
    synopsis: p.synopsis,
    film_page: p.film_page,
    synopsis_en: db.synopsisEn[id],
  };
}

export const mockKitApi: KitApi = {
  getKit: (projectId) => simulate(`GET kit ${projectId}`, S.kitDataSchema, () => kitOf(projectId), 0.5),

  addDossier: (projectId, item) =>
    simulate(
      `POST dossier ${item.festival_id}`,
      S.shortlistItemSchema,
      () => {
        const p = requireProject(projectId);
        const existing = p.festival_shortlist.find((d) => d.festival_id === item.festival_id);
        if (existing) return existing;
        p.festival_shortlist = [...p.festival_shortlist, item];
        persist();
        return item;
      },
      0.5,
    ),

  updateDossier: (projectId, item) =>
    simulate(
      `PATCH dossier ${item.festival_id}`,
      S.shortlistItemSchema,
      () => {
        const p = requireProject(projectId);
        if (!p.festival_shortlist.some((d) => d.festival_id === item.festival_id))
          throw apiError('introuvable', 404, 'Ce dossier n’existe plus.');
        p.festival_shortlist = p.festival_shortlist.map((d) =>
          d.festival_id === item.festival_id ? item : d,
        );
        persist();
        return item;
      },
      0.5,
    ),

  removeDossier: async (projectId, festivalId) => {
    await simulate(
      `DELETE dossier ${festivalId}`,
      S.okSchema,
      () => {
        const p = requireProject(projectId);
        p.festival_shortlist = p.festival_shortlist.filter((d) => d.festival_id !== festivalId);
        persist();
        return { ok: true };
      },
      0.5,
    );
  },

  setPiece: async (projectId, key, state) => {
    await simulate(
      `PUT pièce ${key}`,
      S.okSchema,
      () => {
        requireProject(projectId);
        const db = getDb();
        db.pieces[projectId] = { ...(db.pieces[projectId] ?? {}), [key]: state };
        persist();
        return { ok: true };
      },
      0.5,
    );
  },

  saveFilm: (projectId, patch) =>
    simulate(
      'PUT film',
      S.kitFilmFieldsSchema,
      () => {
        const p = requireProject(projectId);
        const db = getDb();
        const { synopsis_en, ...fields } = patch;
        Object.assign(p, fields);
        if (synopsis_en) db.synopsisEn[projectId] = synopsis_en;
        persist();
        const { film_profile, synopsis, film_page } = p;
        return { film_profile, synopsis, film_page, synopsis_en: db.synopsisEn[projectId] };
      },
      0.5,
    ),
};
