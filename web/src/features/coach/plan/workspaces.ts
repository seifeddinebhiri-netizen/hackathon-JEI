import type { WorkspaceInput, WorkspaceRecord } from '@/api/types';
import { loadPlan, parseStoredPlan, read, write, type StoredPlan } from './store';

/**
 * Espaces de travail du Coach : un espace par scène. Quand l'utilisateur a fini une scène, il crée un
 * nouvel espace pour la suivante ; les autres restent tels quels (scène, plan, modifications, étiquettes).
 *
 * Local d'abord : tout est gardé dans le téléphone (rangé par compte) et marche hors ligne. Quand un
 * compte est connecté, les espaces qui ont un plan sont aussi enregistrés sur le serveur pour être
 * retrouvés après la déconnexion et sur un autre appareil (voir useWorkspaceSync).
 */
export type Workspace = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  plan: StoredPlan | null;
  /** Version de cet espace sur le serveur ; absent tant qu'il n'y a jamais été enregistré. */
  serverVersion?: number;
  /** Modifié ici depuis le dernier enregistrement sur le serveur. */
  dirty: boolean;
};
export type WorkspacesState = {
  activeId: string;
  items: Workspace[];
  /** Espaces supprimés ici dont le serveur n'a pas encore été prévenu (hors ligne). */
  pendingDeletes: string[];
};

export const MAX_WORKSPACES = 12;
export const NAME_MAX = 40;
const DEFAULT_NAME = /^Espace \d+$/;

export type WorkspaceAction =
  | { type: 'create'; id: string; now: string }
  | { type: 'select'; id: string }
  | { type: 'rename'; id: string; name: string; now: string }
  /** `fallbackId` : identifiant du nouvel espace vide si on supprime le dernier. */
  | { type: 'remove'; id: string; fallbackId: string; now: string }
  | { type: 'setPlan'; id: string; plan: StoredPlan | null; now: string }
  /** Le serveur a enregistré cet espace. `pushedUpdatedAt` : la date locale de ce qui a été envoyé. */
  | { type: 'pushed'; id: string; record: WorkspaceRecord; pushedUpdatedAt: string }
  | { type: 'deleted'; id: string }
  /** Liste COMPLÈTE des espaces du serveur : fusion avec les espaces locaux. */
  | { type: 'merge'; records: WorkspaceRecord[]; fallbackId: string; now: string };

// --- Noms ---------------------------------------------------------------------------

export function nextDefaultName(items: Workspace[]): string {
  const used = new Set(items.map((w) => w.name));
  let n = 1;
  while (used.has(`Espace ${n}`)) n++;
  return `Espace ${n}`;
}

/** Un nom court tiré du début de la description de la scène. */
export function titleFromDescription(description: string): string {
  const words = description.trim().split(/\s+/).filter(Boolean);
  const title = words.slice(0, 6).join(' ') + (words.length > 6 ? '…' : '');
  return title.length > NAME_MAX ? `${title.slice(0, NAME_MAX - 1).trimEnd()}…` : title;
}

function emptyWorkspace(id: string, now: string, items: Workspace[]): Workspace {
  return { id, name: nextDefaultName(items), createdAt: now, updatedAt: now, plan: null, dirty: false };
}

// --- Passage vers / depuis le serveur ------------------------------------------------

/** Seuls les espaces qui ont un plan sont enregistrés : un espace vide n'a rien à garder. */
export const isSyncable = (w: Workspace): boolean => w.plan !== null;

/** Ce qu'on envoie au serveur : la configuration de l'espace (scène, plan, modifications, étiquettes). */
export function toInput(w: Workspace): WorkspaceInput {
  const plan = w.plan;
  return {
    name: w.name,
    data: plan
      ? {
          request: plan.request,
          spec: plan.spec,
          overrides: plan.overrides,
          notes: plan.notes,
          timelines: plan.timelines,
        }
      : {},
    base_version: w.serverVersion ?? null,
  };
}

export function fromRecord(rec: WorkspaceRecord): Workspace {
  return {
    id: rec.id,
    name: rec.name.slice(0, NAME_MAX),
    createdAt: rec.created_at,
    updatedAt: rec.updated_at,
    plan: parseStoredPlan({ ...rec.data, savedAt: rec.updated_at }),
    serverVersion: rec.version,
    dirty: false,
  };
}

const time = (iso: string): number => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
};

/** Un espace jamais touché : sans plan, au nom par défaut, jamais enregistré. */
const isPristine = (w: Workspace): boolean =>
  w.plan === null &&
  DEFAULT_NAME.test(w.name) &&
  w.createdAt === w.updatedAt &&
  w.serverVersion === undefined;

/**
 * Fusionne la liste complète du serveur avec les espaces locaux.
 *  - seulement sur le serveur : ajouté ici (sauf si on vient de le supprimer ici) ;
 *  - seulement ici : jamais enregistré -> gardé, sera envoyé ; déjà enregistré -> supprimé depuis un
 *    autre appareil, retiré ici (sauf si modifié ici depuis : la modification gagne, l'espace est recréé) ;
 *  - des deux côtés : si le serveur n'a pas avancé, on garde l'espace d'ici ; s'il a avancé et que rien
 *    n'a changé ici, on prend celui du serveur ; si les deux ont changé, le plus récent gagne.
 */
export function mergeWorkspaces(
  state: WorkspacesState,
  records: WorkspaceRecord[],
  fallbackId: string,
  now: string,
): WorkspacesState {
  const remote = new Map(records.map((r) => [r.id, r]));
  const deleting = new Set(state.pendingDeletes);
  const items: Workspace[] = [];

  for (const w of state.items) {
    const r = remote.get(w.id);
    remote.delete(w.id);
    if (!r) {
      if (w.serverVersion === undefined) items.push(w);
      else if (w.dirty && isSyncable(w)) items.push({ ...w, serverVersion: undefined });
      continue;
    }
    const remoteAdvanced = r.version > (w.serverVersion ?? 0);
    if (!remoteAdvanced) items.push({ ...w, serverVersion: r.version });
    else if (!w.dirty) items.push(fromRecord(r));
    else if (time(w.updatedAt) >= time(r.updated_at))
      items.push({ ...w, serverVersion: r.version }); // ici plus récent
    else items.push(fromRecord(r)); // le serveur est plus récent
  }
  for (const r of remote.values()) if (!deleting.has(r.id)) items.push(fromRecord(r));

  // Un espace vide jamais touché n'a plus lieu d'être dès qu'on a retrouvé de vrais espaces.
  const hasReal = items.some((w) => w.serverVersion !== undefined);
  const kept = hasReal ? items.filter((w) => !isPristine(w)) : items;
  const sorted = [...kept].sort((a, b) => time(a.createdAt) - time(b.createdAt) || a.id.localeCompare(b.id));
  const stillDeleting = state.pendingDeletes.filter((id) => records.some((r) => r.id === id));

  if (sorted.length === 0) {
    const fresh = emptyWorkspace(fallbackId, now, []);
    return { activeId: fresh.id, items: [fresh], pendingDeletes: stillDeleting };
  }
  const activeId = sorted.some((w) => w.id === state.activeId) ? state.activeId : sorted[0].id;
  return { activeId, items: sorted, pendingDeletes: stillDeleting };
}

// --- Réducteur ---------------------------------------------------------------------

export function workspacesReducer(state: WorkspacesState, action: WorkspaceAction): WorkspacesState {
  switch (action.type) {
    case 'create': {
      if (state.items.length >= MAX_WORKSPACES) return state;
      const ws = emptyWorkspace(action.id, action.now, state.items);
      return { ...state, activeId: ws.id, items: [...state.items, ws] };
    }
    case 'select':
      return state.items.some((w) => w.id === action.id) ? { ...state, activeId: action.id } : state;
    case 'rename': {
      const name = action.name.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
      if (!name) return state;
      return {
        ...state,
        items: state.items.map((w) =>
          w.id === action.id ? { ...w, name, updatedAt: action.now, dirty: true } : w,
        ),
      };
    }
    case 'remove': {
      const index = state.items.findIndex((w) => w.id === action.id);
      if (index < 0) return state;
      const removed = state.items[index];
      const pendingDeletes =
        removed.serverVersion !== undefined && !state.pendingDeletes.includes(removed.id)
          ? [...state.pendingDeletes, removed.id]
          : state.pendingDeletes;
      const rest = state.items.filter((w) => w.id !== action.id);
      if (rest.length === 0) {
        const fresh = emptyWorkspace(action.fallbackId, action.now, []);
        return { activeId: fresh.id, items: [fresh], pendingDeletes };
      }
      const activeId =
        state.activeId === action.id ? rest[Math.min(index, rest.length - 1)].id : state.activeId;
      return { activeId, items: rest, pendingDeletes };
    }
    case 'setPlan':
      return {
        ...state,
        items: state.items.map((w) => {
          if (w.id !== action.id) return w;
          // Un espace encore nommé « Espace N » prend le nom de sa scène dès qu'il a un plan.
          const name =
            action.plan && DEFAULT_NAME.test(w.name)
              ? titleFromDescription(action.plan.request.description) || w.name
              : w.name;
          return { ...w, name, plan: action.plan, updatedAt: action.now, dirty: true };
        }),
      };
    case 'pushed':
      return {
        ...state,
        items: state.items.map((w) => {
          if (w.id !== action.id) return w;
          const synced = { ...w, serverVersion: action.record.version, createdAt: action.record.created_at };
          // Modifié pendant l'envoi : il reste à envoyer, avec la nouvelle version comme base.
          return w.updatedAt === action.pushedUpdatedAt
            ? { ...synced, dirty: false, updatedAt: action.record.updated_at }
            : synced;
        }),
      };
    case 'deleted':
      return { ...state, pendingDeletes: state.pendingDeletes.filter((id) => id !== action.id) };
    case 'merge':
      return mergeWorkspaces(state, action.records, action.fallbackId, action.now);
  }
}

// --- Stockage local ------------------------------------------------------------------

const key = (userId: string) => `pp-coach-workspaces-v1:${userId}`;

/** Identifiant au format UUID (le serveur l'exige), même si le navigateur n'a pas `randomUUID`. */
export function newId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  const hex = (n: number) =>
    Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${'89ab'[Math.floor(Math.random() * 4)]}${hex(3)}-${hex(12)}`;
}
export const nowIso = (): string => new Date().toISOString();

function parseWorkspace(value: unknown): Workspace | null {
  const w = value as Partial<Workspace> | null;
  if (!w || typeof w.id !== 'string' || typeof w.name !== 'string' || !w.name.trim()) return null;
  const plan = parseStoredPlan(w.plan);
  return {
    id: w.id,
    name: w.name.slice(0, NAME_MAX),
    createdAt: typeof w.createdAt === 'string' ? w.createdAt : '',
    updatedAt: typeof w.updatedAt === 'string' ? w.updatedAt : '',
    plan,
    serverVersion: typeof w.serverVersion === 'number' ? w.serverVersion : undefined,
    // Espace gardé avant la synchronisation : à envoyer une première fois.
    dirty: typeof w.dirty === 'boolean' ? w.dirty : plan !== null,
  };
}

/**
 * Lit les espaces de l'utilisateur. S'il n'en a pas encore : reprend l'ancien plan unique (avant les
 * espaces) comme premier espace, sinon crée un espace vide. Il y a toujours au moins un espace.
 */
export function loadWorkspaces(
  userId: string,
  makeId: () => string = newId,
  now: () => string = nowIso,
): WorkspacesState {
  const raw = read(key(userId)) as { activeId?: unknown; items?: unknown; pendingDeletes?: unknown } | null;
  const items = Array.isArray(raw?.items)
    ? raw.items.map(parseWorkspace).filter((w): w is Workspace => w !== null)
    : [];
  const unique = items.filter((w, i) => items.findIndex((x) => x.id === w.id) === i).slice(0, MAX_WORKSPACES);
  const pendingDeletes = Array.isArray(raw?.pendingDeletes)
    ? raw.pendingDeletes.filter((id): id is string => typeof id === 'string')
    : [];
  if (unique.length > 0) {
    const activeId = unique.some((w) => w.id === raw?.activeId) ? (raw?.activeId as string) : unique[0].id;
    return { activeId, items: unique, pendingDeletes };
  }
  const legacy = loadPlan(userId);
  const ws = emptyWorkspace(makeId(), now(), []);
  if (legacy) {
    ws.plan = legacy;
    ws.name = titleFromDescription(legacy.request.description) || ws.name;
    ws.dirty = true;
  }
  return { activeId: ws.id, items: [ws], pendingDeletes };
}

export const saveWorkspaces = (userId: string, state: WorkspacesState): void => write(key(userId), state);
