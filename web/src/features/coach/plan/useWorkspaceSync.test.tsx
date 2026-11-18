import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '@/api';
import type { WorkspaceInput, WorkspaceRecord } from '@/api/types';
import { plan, record } from './testData';
import { SYNC_DEBOUNCE_MS, SYNC_RETRY_MS } from './useWorkspaceSync';
import { useWorkspaces } from './useWorkspaces';

vi.mock('@/api', async (orig) => ({
  ...(await orig<typeof import('@/api')>()),
  api: { listWorkspaces: vi.fn(), putWorkspace: vi.fn(), deleteWorkspace: vi.fn() },
}));

const list = vi.mocked(api.listWorkspaces);
const put = vi.mocked(api.putWorkspace);
const del = vi.mocked(api.deleteWorkspace);

const offline = () => new ApiError(0, 'reseau', 'Impossible de joindre le serveur.');
const conflict = () => new ApiError(409, 'conflit', 'Modifié ailleurs.');

/** Faux serveur : garde les espaces en mémoire et compte les versions, comme le vrai. */
function fakeServer(initial: WorkspaceRecord[] = []) {
  const rows = new Map(initial.map((r) => [r.id, r]));
  list.mockImplementation(async () => [...rows.values()]);
  put.mockImplementation(async (id: string, input: WorkspaceInput) => {
    const cur = rows.get(id);
    if ((cur?.version ?? null) !== input.base_version) throw conflict();
    const now = new Date(Date.now()).toISOString();
    const next: WorkspaceRecord = {
      id,
      name: input.name,
      data: input.data,
      version: (cur?.version ?? 0) + 1,
      created_at: cur?.created_at ?? now,
      updated_at: now,
    };
    rows.set(id, next);
    return next;
  });
  del.mockImplementation(async (id: string) => {
    rows.delete(id);
    return { ok: true };
  });
  return rows;
}

const settle = (ms = SYNC_DEBOUNCE_MS + 100) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

function setup(enabled = true) {
  return renderHook(() => useWorkspaces('u1', enabled));
}

describe('synchronisation des espaces avec le compte', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(new Date('2026-11-18T10:00:00Z'));
    list.mockReset();
    put.mockReset();
    del.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sans compte réel : rien n’est envoyé, tout reste dans le téléphone', async () => {
    fakeServer();
    const { result } = setup(false);
    act(() => result.current.setPlan(result.current.active.id, plan('Une scène assez longue.')));
    await settle(5000);
    expect(list).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
    expect(result.current.sync.status).toBe('off');
  });

  it('au démarrage : récupère les espaces du compte (autre appareil) et retire l’espace vide inutile', async () => {
    fakeServer([record('a', 'Café de la médina', 3)]);
    const { result } = setup();
    await settle(50);
    expect(result.current.items.map((w) => w.name)).toEqual(['Café de la médina']);
    expect(result.current.active.plan?.request.description).toBe('Une scène assez longue.');
    expect(result.current.sync.status).toBe('synced');
    expect(put).not.toHaveBeenCalled(); // rien à renvoyer
  });

  it('après une modification : envoyé au bout d’un court délai, avec sa configuration, une seule fois', async () => {
    fakeServer();
    const { result } = setup();
    await settle(50);
    const id = result.current.active.id;
    act(() => result.current.setPlan(id, plan('Un vieil homme boit son thé dans un café.')));
    await settle(SYNC_DEBOUNCE_MS - 200);
    expect(put).not.toHaveBeenCalled(); // on attend de regrouper les modifications
    await settle(300);
    expect(put).toHaveBeenCalledTimes(1);
    const [sentId, input] = put.mock.calls[0];
    expect(sentId).toBe(id);
    expect(input.base_version).toBeNull(); // création
    expect(input.name).toBe('Un vieil homme boit son thé…');
    expect(Object.keys(input.data).sort()).toEqual(['notes', 'overrides', 'request', 'spec', 'timelines']);
    expect(result.current.active).toMatchObject({ dirty: false, serverVersion: 1 });
    await settle(5000);
    expect(put).toHaveBeenCalledTimes(1);
  });

  it('plusieurs modifications rapprochées : un seul envoi, puis une mise à jour avec la bonne version', async () => {
    fakeServer();
    const { result } = setup();
    await settle(50);
    const id = result.current.active.id;
    act(() => result.current.setPlan(id, plan('Une scène assez longue.')));
    await settle(500);
    act(() => result.current.rename(id, 'Mon café'));
    await settle(SYNC_DEBOUNCE_MS + 100);
    expect(put).toHaveBeenCalledTimes(1);
    expect(put.mock.calls[0][1].name).toBe('Mon café');
    act(() => result.current.rename(id, 'Mon café 2'));
    await settle();
    expect(put).toHaveBeenCalledTimes(2);
    expect(put.mock.calls[1][1].base_version).toBe(1); // part de la version déjà enregistrée
  });

  it('hors ligne : rien n’est perdu, l’espace reste « à envoyer » et part au retour du réseau', async () => {
    fakeServer();
    const { result } = setup();
    await settle(50);
    const id = result.current.active.id;
    put.mockRejectedValueOnce(offline());
    act(() => result.current.setPlan(id, plan('Une scène assez longue.')));
    await settle();
    expect(result.current.sync.status).toBe('offline');
    expect(result.current.sync.message).toMatch(/gardés dans ce téléphone/);
    expect(result.current.active.dirty).toBe(true);

    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await vi.advanceTimersByTimeAsync(50); // récupération des espaces du compte
    });
    await settle(); // puis envoi des modifications en attente
    expect(result.current.sync.status).toBe('synced');
    expect(result.current.active).toMatchObject({ dirty: false, serverVersion: 1 });
  });

  it('hors ligne sans événement : une nouvelle tentative a lieu toute seule', async () => {
    fakeServer();
    const { result } = setup();
    await settle(50);
    put.mockRejectedValueOnce(offline());
    act(() => result.current.setPlan(result.current.active.id, plan('Une scène assez longue.')));
    await settle();
    expect(result.current.sync.status).toBe('offline');
    await settle(SYNC_RETRY_MS + 100);
    expect(result.current.sync.status).toBe('synced');
    expect(put).toHaveBeenCalledTimes(2);
  });

  it('deux appareils : un envoi périmé (409) récupère le serveur ; ma modification, plus récente, est renvoyée', async () => {
    const rows = fakeServer();
    const { result } = setup();
    await settle(50);
    const id = result.current.active.id;
    act(() => result.current.setPlan(id, plan('Une scène assez longue.')));
    await settle();
    expect(result.current.active.serverVersion).toBe(1);

    // L'autre appareil modifie l'espace (version 2) ; ce téléphone ne le sait pas encore.
    rows.set(id, {
      ...rows.get(id)!,
      name: 'Nom venu de l’autre appareil',
      version: 2,
      updated_at: '2026-11-18T09:00:00Z',
    });
    vi.setSystemTime(new Date('2026-11-18T10:30:00Z'));
    act(() => result.current.rename(id, 'Mon nom, plus récent'));
    await settle(SYNC_DEBOUNCE_MS + 300);
    await settle(SYNC_DEBOUNCE_MS + 300);

    expect(put.mock.calls.map((c) => c[1].base_version)).toEqual([null, 1, 2]); // 409 puis nouvel essai avec la version à jour
    expect(rows.get(id)).toMatchObject({ name: 'Mon nom, plus récent', version: 3 });
    expect(result.current.active).toMatchObject({
      name: 'Mon nom, plus récent',
      serverVersion: 3,
      dirty: false,
    });
  });

  it('deux appareils : si l’autre est plus récent, c’est lui qui gagne ici', async () => {
    const rows = fakeServer();
    const { result } = setup();
    await settle(50);
    const id = result.current.active.id;
    act(() => result.current.setPlan(id, plan('Une scène assez longue.')));
    await settle();

    vi.setSystemTime(new Date('2026-11-18T10:10:00Z'));
    act(() => result.current.rename(id, 'Ma modif, plus ancienne'));
    rows.set(id, {
      ...rows.get(id)!,
      name: 'Modif de l’autre appareil',
      version: 2,
      updated_at: '2026-11-18T11:00:00Z',
    });
    await settle(SYNC_DEBOUNCE_MS + 300);
    await settle(SYNC_DEBOUNCE_MS + 300);

    expect(result.current.active).toMatchObject({
      name: 'Modif de l’autre appareil',
      serverVersion: 2,
      dirty: false,
    });
    expect(rows.get(id)!.name).toBe('Modif de l’autre appareil'); // le serveur n'a pas été écrasé
  });

  it('supprimer un espace enregistré prévient le serveur ; hors ligne, la suppression est retentée', async () => {
    const rows = fakeServer();
    const { result } = setup();
    await settle(50);
    const id = result.current.active.id;
    act(() => result.current.setPlan(id, plan('Une scène assez longue.')));
    await settle();
    expect(rows.has(id)).toBe(true);

    del.mockRejectedValueOnce(offline());
    act(() => result.current.remove(id));
    await settle();
    expect(result.current.sync.status).toBe('offline');
    expect(rows.has(id)).toBe(true);

    await settle(SYNC_RETRY_MS + 100);
    expect(rows.has(id)).toBe(false);
    expect(result.current.sync.status).toBe('synced');
  });

  it('un espace vide n’est jamais envoyé', async () => {
    fakeServer();
    const { result } = setup();
    await settle(50);
    act(() => result.current.rename(result.current.active.id, 'Juste un nom'));
    act(() => result.current.create());
    await settle(5000);
    expect(put).not.toHaveBeenCalled();
  });

  it('session expirée : erreur explicite, les espaces restent dans le téléphone', async () => {
    fakeServer();
    const { result } = setup();
    await settle(50);
    put.mockRejectedValue(new ApiError(401, 'non_autorise', 'Ta session a expiré. Reconnecte-toi.'));
    act(() => result.current.setPlan(result.current.active.id, plan('Une scène assez longue.')));
    await settle();
    expect(result.current.sync.status).toBe('error');
    expect(result.current.sync.message).toMatch(/reconnecte-toi/i);
    expect(result.current.active.dirty).toBe(true);
  });
});
