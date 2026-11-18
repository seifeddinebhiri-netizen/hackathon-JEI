import { useCallback, useEffect, useRef, useState, type Dispatch } from 'react';
import { api, isApiError } from '@/api';
import { isSyncable, newId, nowIso, toInput, type WorkspaceAction, type WorkspacesState } from './workspaces';

/**
 * Synchronise les espaces de travail avec le compte (serveur) : local d'abord, le serveur ensuite.
 *  - au démarrage et quand l'appli revient au premier plan ou retrouve le réseau : on récupère les espaces
 *    du serveur et on les fusionne avec ceux du téléphone ;
 *  - après chaque modification : on envoie les espaces modifiés au bout d'un court délai ;
 *  - hors ligne : rien n'est perdu, l'espace reste « à envoyer » et part dès que possible.
 * Deux appareils qui modifient le même espace : le serveur refuse l'envoi périmé (409), on récupère l'état
 * du serveur, la modification la plus récente gagne.
 */
export type SyncStatus = 'off' | 'syncing' | 'synced' | 'offline' | 'error';

export const SYNC_DEBOUNCE_MS = 1200;
export const SYNC_RETRY_MS = 15_000;
const MAX_CONFLICTS = 3;

export const hasPendingWork = (s: WorkspacesState): boolean =>
  s.pendingDeletes.length > 0 || s.items.some((w) => isSyncable(w) && w.dirty);

function describeFailure(e: unknown): { status: SyncStatus; message: string } {
  if (isApiError(e)) {
    if (e.status === 0 && (e.code === 'reseau' || e.code === 'delai_depasse')) {
      return {
        status: 'offline',
        message:
          'Pas de connexion : tes espaces sont gardés dans ce téléphone et seront envoyés dès que possible.',
      };
    }
    if (e.status === 401)
      return {
        status: 'error',
        message: 'Session expirée : reconnecte-toi pour enregistrer tes espaces sur ton compte.',
      };
    return { status: 'error', message: e.message };
  }
  return { status: 'error', message: 'Enregistrement sur ton compte impossible pour le moment.' };
}

export function useWorkspaceSync(
  enabled: boolean,
  state: WorkspacesState,
  dispatch: Dispatch<WorkspaceAction>,
) {
  const [status, setStatus] = useState<SyncStatus>('syncing');
  const [message, setMessage] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });
  const chain = useRef<Promise<void>>(Promise.resolve());
  const conflicts = useRef(0);

  const succeed = useCallback(() => {
    setStatus('synced');
    setMessage('');
    setLastSyncedAt(nowIso());
  }, []);
  const fail = useCallback((e: unknown) => {
    const f = describeFailure(e);
    setStatus(f.status);
    setMessage(f.message);
  }, []);

  /** Une seule opération à la fois : un envoi ne se mélange pas à une récupération. */
  const enqueue = useCallback((task: () => Promise<void>) => {
    chain.current = chain.current.then(task, task);
    return chain.current;
  }, []);

  const pullTask = useCallback(async () => {
    setStatus('syncing');
    try {
      const records = await api.listWorkspaces();
      dispatch({ type: 'merge', records, fallbackId: newId(), now: nowIso() });
      succeed();
    } catch (e) {
      fail(e);
    }
  }, [dispatch, succeed, fail]);

  const pushTask = useCallback(async () => {
    const s = stateRef.current;
    if (!hasPendingWork(s)) return;
    setStatus('syncing');
    try {
      for (const id of s.pendingDeletes) {
        await api.deleteWorkspace(id);
        dispatch({ type: 'deleted', id });
      }
      for (const w of s.items.filter((x) => isSyncable(x) && x.dirty)) {
        try {
          const record = await api.putWorkspace(w.id, toInput(w));
          dispatch({ type: 'pushed', id: w.id, record, pushedUpdatedAt: w.updatedAt });
        } catch (e) {
          if (!(isApiError(e) && e.status === 409)) throw e;
          // Modifié depuis un autre appareil : on récupère l'état du serveur ; la fusion tranche, puis le
          // prochain envoi repart de la bonne version.
          if (++conflicts.current > MAX_CONFLICTS) throw e;
          const records = await api.listWorkspaces();
          dispatch({ type: 'merge', records, fallbackId: newId(), now: nowIso() });
          return;
        }
      }
      conflicts.current = 0;
      succeed();
    } catch (e) {
      fail(e);
    }
  }, [dispatch, succeed, fail]);

  const pull = useCallback(
    () => (enabled ? enqueue(pullTask) : Promise.resolve()),
    [enabled, enqueue, pullTask],
  );
  const push = useCallback(
    () => (enabled ? enqueue(pushTask) : Promise.resolve()),
    [enabled, enqueue, pushTask],
  );

  // Au démarrage : récupérer les espaces du compte.
  useEffect(() => {
    void pull();
  }, [pull]);

  // Après chaque modification : envoyer, au bout d'un court délai (on regroupe les frappes).
  const pending = hasPendingWork(state);
  useEffect(() => {
    if (!enabled || !pending) return;
    const timer = setTimeout(() => void push(), SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [enabled, pending, state, push]);

  // Hors ligne ou en erreur avec du travail en attente : on retente de temps en temps.
  useEffect(() => {
    if (!enabled || !pending || (status !== 'offline' && status !== 'error')) return;
    const timer = setTimeout(() => void push(), SYNC_RETRY_MS);
    return () => clearTimeout(timer);
  }, [enabled, pending, status, push]);

  // L'appli revient au premier plan ou retrouve le réseau : récupérer ce qui a changé ailleurs.
  useEffect(() => {
    if (!enabled) return;
    const refresh = () => void pull();
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, pull]);

  return { status: enabled ? status : ('off' as SyncStatus), message, lastSyncedAt };
}
