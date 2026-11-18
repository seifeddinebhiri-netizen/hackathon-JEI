import { useEffect, useMemo, useReducer } from 'react';
import type { StoredPlan } from './store';
import { useWorkspaceSync } from './useWorkspaceSync';
import { loadWorkspaces, newId, nowIso, saveWorkspaces, workspacesReducer } from './workspaces';

/**
 * Les espaces de travail de l'utilisateur : gardés dans son téléphone à chaque changement, et
 * enregistrés sur son compte quand `syncEnabled` (compte réel connecté).
 */
export function useWorkspaces(userId: string, syncEnabled: boolean) {
  const [state, dispatch] = useReducer(workspacesReducer, userId, (u) => loadWorkspaces(u));
  useEffect(() => saveWorkspaces(userId, state), [userId, state]);
  const sync = useWorkspaceSync(syncEnabled, state, dispatch);

  const actions = useMemo(
    () => ({
      create: () => dispatch({ type: 'create', id: newId(), now: nowIso() }),
      select: (id: string) => dispatch({ type: 'select', id }),
      rename: (id: string, name: string) => dispatch({ type: 'rename', id, name, now: nowIso() }),
      remove: (id: string) => dispatch({ type: 'remove', id, fallbackId: newId(), now: nowIso() }),
      setPlan: (id: string, plan: StoredPlan | null) =>
        dispatch({ type: 'setPlan', id, plan, now: nowIso() }),
    }),
    [],
  );
  const active = state.items.find((w) => w.id === state.activeId) ?? state.items[0];
  return { items: state.items, active, sync, ...actions };
}
