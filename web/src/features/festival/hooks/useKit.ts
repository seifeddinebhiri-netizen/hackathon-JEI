/**
 * Données du Kit Festival (dossiers, pièces, synopsis, profil et page du film) : lues et écrites
 * par `kitApi` (Supabase, ou mocks si VITE_USE_MOCKS=true), gardées dans le cache React Query.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  kitApi,
  type Festival,
  type FestivalRequirement,
  type KitData,
  type KitFilmFields,
  type KitPieceState,
  type Project,
  type ShortlistItem,
  type SynopsisEnDraft,
  type SynopsisKind,
} from '@/api';
import { useAutosave } from '@/features/planner/hooks/useAutosave';
import { pieceKeyOf } from '../lib/dossier';

export const kitKeys = { one: (projectId: string) => ['kit', projectId] as const };

export function useKit(projectId: string | undefined) {
  return useQuery({
    queryKey: kitKeys.one(projectId ?? 'aucun'),
    queryFn: () => kitApi.getKit(projectId!),
    enabled: !!projectId,
  });
}

/** Le projet tel que le lisent les écrans du Kit : ses dossiers et champs du film viennent du Kit. */
export function withKit(project: Project, kit: KitData): Project {
  return {
    ...project,
    festival_shortlist: kit.dossiers,
    film_profile: kit.film_profile,
    synopsis: kit.synopsis,
    film_page: kit.film_page,
  };
}

type Op =
  | { type: 'add'; item: ShortlistItem }
  | { type: 'update'; item: ShortlistItem }
  | { type: 'remove'; festivalId: string }
  | { type: 'piece'; key: string; state: KitPieceState };

function apply(k: KitData, op: Op): KitData {
  switch (op.type) {
    case 'add':
      return k.dossiers.some((d) => d.festival_id === op.item.festival_id)
        ? k
        : { ...k, dossiers: [...k.dossiers, op.item] };
    case 'update':
      return {
        ...k,
        dossiers: k.dossiers.map((d) => (d.festival_id === op.item.festival_id ? op.item : d)),
      };
    case 'remove':
      return { ...k, dossiers: k.dossiers.filter((d) => d.festival_id !== op.festivalId) };
    case 'piece':
      return { ...k, pieces: { ...k.pieces, [op.key]: op.state } };
  }
}

function run(projectId: string, op: Op): Promise<unknown> {
  switch (op.type) {
    case 'add':
      return kitApi.addDossier(projectId, op.item);
    case 'update':
      return kitApi.updateDossier(projectId, op.item);
    case 'remove':
      return kitApi.removeDossier(projectId, op.festivalId);
    case 'piece':
      return kitApi.setPiece(projectId, op.key, op.state);
  }
}

/** « Mes dossiers » : ajout, retrait, « Où j'en suis », pièces cochées (affichage immédiat). */
export function useShortlist(project: Project) {
  const qc = useQueryClient();
  const key = kitKeys.one(project.id);
  const mutation = useMutation({
    mutationFn: (op: Op) => run(project.id, op),
    onMutate: async (op) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<KitData>(key);
      if (prev) qc.setQueryData<KitData>(key, apply(prev, op));
      return { prev };
    },
    onError: (_e, _op, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
  const current = () => qc.getQueryData<KitData>(key)?.dossiers ?? project.festival_shortlist;
  return {
    pending: mutation.isPending,
    error: mutation.error,
    add: (item: ShortlistItem) =>
      current().some((s) => s.festival_id === item.festival_id)
        ? Promise.resolve()
        : mutation.mutateAsync({ type: 'add', item }),
    remove: (festivalId: string) => mutation.mutateAsync({ type: 'remove', festivalId }),
    /** Remplace « Où j'en suis » et la réponse IA d'un dossier existant. */
    replace: (item: ShortlistItem) => mutation.mutateAsync({ type: 'update', item }),
    /** Coche une pièce : une fois pour tous les dossiers qui la demandent. */
    setPiece: (f: Festival, r: FestivalRequirement, done: boolean) => {
      const k = pieceKeyOf(f, r);
      return k
        ? mutation.mutateAsync({ type: 'piece', key: k, state: done ? 'pret' : 'a_faire' })
        : Promise.resolve();
    },
  };
}

/** Enregistre des champs du film (synopsis, profil, page film, synopsis anglais). */
export function useSaveKitFilm(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: KitFilmFields) => kitApi.saveFilm(projectId, patch),
    onSuccess: (film, patch) =>
      qc.setQueryData<KitData>(kitKeys.one(projectId), (k) => {
        if (!k) return k;
        // Seuls les champs envoyés sont repris : une saisie plus récente d'un autre champ reste.
        const next = { ...k };
        for (const f of Object.keys(patch) as (keyof KitFilmFields)[]) Object.assign(next, { [f]: film[f] });
        return next;
      }),
  });
}

/** Version anglaise d'un synopsis (brouillon IA relu), enregistrée automatiquement. */
export function useSynopsisEnglish(projectId: string, kind: SynopsisKind) {
  const qc = useQueryClient();
  const kit = useKit(projectId);
  const save = useSaveKitFilm(projectId);
  const [draft, setDraft] = useState<SynopsisEnDraft | null>(() => kit.data?.synopsis_en?.[kind] ?? null);
  const autosave = useAutosave(draft, (d) => {
    // Les autres versions viennent du cache : une seule colonne pour les trois.
    const all = { ...(qc.getQueryData<KitData>(kitKeys.one(projectId))?.synopsis_en ?? {}) };
    if (d) all[kind] = d;
    else delete all[kind];
    return save.mutateAsync({ synopsis_en: all });
  });
  return [draft, setDraft, autosave.state] as const;
}
