/**
 * Kit Festival : dossiers, pièces et champs du film (synopsis, profil, page film).
 * VITE_USE_MOCKS=true → données simulées (mocks/kit.ts) ; sinon → Supabase (supabase/kit.ts),
 * lu et écrit directement avec la clé publique, la sécurité par ligne limitant chacun à ses lignes.
 * Les deux respectent le type `KitApi` : aucun écran ne change quand on bascule.
 */
import { env } from '@/lib/env';
import { mockKitApi } from './mocks/kit';
import { supabaseKitApi } from './supabase/kit';
import type { KitData, KitFilmFields, KitPieceState, ShortlistItem } from './types';

export type KitApi = {
  getKit: (projectId: string) => Promise<KitData>;
  /** Ajoute un dossier (sans effet s'il existe déjà). */
  addDossier: (projectId: string, item: ShortlistItem) => Promise<ShortlistItem>;
  /** « Où j'en suis » et réponse à la question IA d'un dossier existant. */
  updateDossier: (projectId: string, item: ShortlistItem) => Promise<ShortlistItem>;
  removeDossier: (projectId: string, festivalId: string) => Promise<void>;
  /** Pièce cochée à la main : une seule ligne par projet, pour tous les dossiers qui la demandent. */
  setPiece: (projectId: string, key: string, state: KitPieceState) => Promise<void>;
  /** Enregistre seulement les champs envoyés. */
  saveFilm: (projectId: string, patch: KitFilmFields) => Promise<KitFilmFields>;
};

export const kitApi: KitApi = env.useMocks ? mockKitApi : supabaseKitApi;
