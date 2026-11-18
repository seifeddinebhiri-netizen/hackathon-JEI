import { beforeEach, describe, expect, it } from 'vitest';
import { NOW, plan, record } from './testData';
import { savePlan } from './store';
import {
  fromRecord,
  isSyncable,
  loadWorkspaces,
  MAX_WORKSPACES,
  mergeWorkspaces,
  nextDefaultName,
  NAME_MAX,
  saveWorkspaces,
  titleFromDescription,
  toInput,
  workspacesReducer,
  type Workspace,
  type WorkspacesState,
} from './workspaces';

const ws = (id: string, name: string, extra: Partial<Workspace> = {}): Workspace => ({
  id,
  name,
  createdAt: NOW,
  updatedAt: NOW,
  plan: null,
  dirty: false,
  ...extra,
});
const state = (activeId: string, items: Workspace[], pendingDeletes: string[] = []): WorkspacesState => ({
  activeId,
  items,
  pendingDeletes,
});
const withPlan = (id: string, name: string, extra: Partial<Workspace> = {}) =>
  ws(id, name, { plan: plan('Une scène assez longue.'), ...extra });

describe('espaces de travail : logique locale', () => {
  it('créer un espace le rend actif et lui donne un nom libre', () => {
    let s = state('a', [ws('a', 'Espace 1')]);
    s = workspacesReducer(s, { type: 'create', id: 'b', now: NOW });
    expect(s.activeId).toBe('b');
    expect(s.items.map((w) => w.name)).toEqual(['Espace 1', 'Espace 2']);
    s = workspacesReducer(s, { type: 'remove', id: 'a', fallbackId: 'x', now: NOW });
    expect(nextDefaultName(s.items)).toBe('Espace 1'); // le plus petit numéro libre
  });

  it(`pas plus de ${MAX_WORKSPACES} espaces`, () => {
    let s = state('0', [ws('0', 'Espace 1')]);
    for (let i = 1; i < MAX_WORKSPACES + 3; i++)
      s = workspacesReducer(s, { type: 'create', id: String(i), now: NOW });
    expect(s.items).toHaveLength(MAX_WORKSPACES);
  });

  it('sélectionner : seulement un espace qui existe', () => {
    const s = state('a', [ws('a', 'A'), ws('b', 'B')]);
    expect(workspacesReducer(s, { type: 'select', id: 'b' }).activeId).toBe('b');
    expect(workspacesReducer(s, { type: 'select', id: 'inconnu' })).toBe(s);
  });

  it('renommer : espaces réduits, longueur limitée, nom vide refusé ; l’espace est « à envoyer »', () => {
    const s = state('a', [ws('a', 'A')]);
    const renamed = workspacesReducer(s, { type: 'rename', id: 'a', name: '  Café   médina  ', now: NOW });
    expect(renamed.items[0]).toMatchObject({ name: 'Café médina', dirty: true });
    expect(
      workspacesReducer(s, { type: 'rename', id: 'a', name: 'x'.repeat(100), now: NOW }).items[0].name,
    ).toHaveLength(NAME_MAX);
    expect(workspacesReducer(s, { type: 'rename', id: 'a', name: '   ', now: NOW })).toBe(s);
  });

  it('supprimer l’espace actif sélectionne son voisin ; supprimer le dernier en recrée un vide', () => {
    let s = state('b', [ws('a', 'A'), ws('b', 'B'), ws('c', 'C')]);
    s = workspacesReducer(s, { type: 'remove', id: 'b', fallbackId: 'x', now: NOW });
    expect(s.items.map((w) => w.id)).toEqual(['a', 'c']);
    expect(s.activeId).toBe('c');
    s = workspacesReducer(s, { type: 'remove', id: 'a', fallbackId: 'x', now: NOW });
    expect(s.activeId).toBe('c');
    s = workspacesReducer(s, { type: 'remove', id: 'c', fallbackId: 'neuf', now: NOW });
    expect(s).toMatchObject({ activeId: 'neuf', items: [{ id: 'neuf', name: 'Espace 1', plan: null }] });
  });

  it('un plan donne à l’espace le nom de sa scène, sauf s’il a déjà été nommé ; il devient « à envoyer »', () => {
    const named = workspacesReducer(state('a', [ws('a', 'Espace 1')]), {
      type: 'setPlan',
      id: 'a',
      plan: plan('Un vieil homme boit son thé dans un café.'),
      now: NOW,
    });
    expect(named.items[0]).toMatchObject({ name: 'Un vieil homme boit son thé…', dirty: true });
    const own = workspacesReducer(state('a', [ws('a', 'Mon café')]), {
      type: 'setPlan',
      id: 'a',
      plan: plan('Autre scène complètement.'),
      now: NOW,
    });
    expect(own.items[0].name).toBe('Mon café');
  });

  it('titre court tiré de la description', () => {
    expect(titleFromDescription('  Amira ouvre le café  ')).toBe('Amira ouvre le café');
    expect(titleFromDescription('un deux trois quatre cinq six sept')).toBe('un deux trois quatre cinq six…');
    expect(titleFromDescription('x'.repeat(200)).length).toBeLessThanOrEqual(NAME_MAX);
    expect(titleFromDescription('   ')).toBe('');
  });
});

describe('espaces de travail : enregistrement sur le compte', () => {
  it('seuls les espaces qui ont un plan sont envoyés, avec leur configuration complète', () => {
    expect(isSyncable(ws('a', 'A'))).toBe(false);
    const w = withPlan('a', 'Café', { serverVersion: 3 });
    expect(isSyncable(w)).toBe(true);
    const input = toInput(w);
    expect(input.name).toBe('Café');
    expect(input.base_version).toBe(3);
    expect(Object.keys(input.data).sort()).toEqual(['notes', 'overrides', 'request', 'spec', 'timelines']);
    expect(toInput(withPlan('b', 'B')).base_version).toBeNull(); // jamais envoyé : création
  });

  it('un espace du serveur redevient un espace local identique', () => {
    const w = fromRecord(record('a', 'Café', 4, '2026-11-18T11:00:00Z', 'Un vieil homme boit son thé.'));
    expect(w).toMatchObject({
      id: 'a',
      name: 'Café',
      serverVersion: 4,
      dirty: false,
      updatedAt: '2026-11-18T11:00:00Z',
    });
    expect(w.plan?.request.description).toBe('Un vieil homme boit son thé.');
    expect(w.plan?.spec.shots).toHaveLength(1);
  });

  it('« pushed » : le serveur a enregistré ; une modification faite pendant l’envoi reste à envoyer', () => {
    const w = withPlan('a', 'A', { dirty: true, updatedAt: '2026-11-18T10:00:05Z' });
    const rec = record('a', 'A', 1, '2026-11-18T10:00:06Z');
    const clean = workspacesReducer(state('a', [w]), {
      type: 'pushed',
      id: 'a',
      record: rec,
      pushedUpdatedAt: '2026-11-18T10:00:05Z',
    });
    expect(clean.items[0]).toMatchObject({
      dirty: false,
      serverVersion: 1,
      updatedAt: '2026-11-18T10:00:06Z',
    });
    const edited = workspacesReducer(state('a', [{ ...w, updatedAt: '2026-11-18T10:00:09Z' }]), {
      type: 'pushed',
      id: 'a',
      record: rec,
      pushedUpdatedAt: '2026-11-18T10:00:05Z',
    });
    expect(edited.items[0]).toMatchObject({
      dirty: true,
      serverVersion: 1,
      updatedAt: '2026-11-18T10:00:09Z',
    });
  });

  it('supprimer un espace déjà enregistré : le serveur reste à prévenir ; « deleted » le retire de la liste', () => {
    let s = workspacesReducer(state('a', [withPlan('a', 'A', { serverVersion: 1 }), ws('b', 'B')]), {
      type: 'remove',
      id: 'a',
      fallbackId: 'x',
      now: NOW,
    });
    expect(s.pendingDeletes).toEqual(['a']);
    s = workspacesReducer(s, { type: 'deleted', id: 'a' });
    expect(s.pendingDeletes).toEqual([]);
    const never = workspacesReducer(state('b', [ws('b', 'B'), ws('c', 'C')]), {
      type: 'remove',
      id: 'c',
      fallbackId: 'x',
      now: NOW,
    });
    expect(never.pendingDeletes).toEqual([]); // jamais enregistré : rien à dire au serveur
  });
});

describe('fusion avec le serveur (plusieurs appareils)', () => {
  const merge = (s: WorkspacesState, records: ReturnType<typeof record>[]) =>
    mergeWorkspaces(s, records, 'neuf', NOW);

  it('un espace créé sur un autre appareil apparaît ici', () => {
    const s = merge(state('a', [withPlan('a', 'A', { serverVersion: 1 })]), [
      record('a', 'A', 1),
      record('b', 'B', 1),
    ]);
    expect(s.items.map((w) => w.id).sort()).toEqual(['a', 'b']);
  });

  it('un espace que je viens de supprimer ici n’est pas ressuscité par le serveur', () => {
    const s = merge(state('a', [withPlan('a', 'A', { serverVersion: 1 })], ['b']), [
      record('a', 'A', 1),
      record('b', 'B', 1),
    ]);
    expect(s.items.map((w) => w.id)).toEqual(['a']);
    expect(s.pendingDeletes).toEqual(['b']);
    expect(merge(s, [record('a', 'A', 1)]).pendingDeletes).toEqual([]); // le serveur ne l'a plus : suppression confirmée
  });

  it('jamais enregistré : gardé, il partira', () => {
    const s = merge(state('a', [withPlan('a', 'A', { dirty: true })]), []);
    expect(s.items[0]).toMatchObject({ id: 'a', dirty: true });
    expect(s.items[0].serverVersion).toBeUndefined();
  });

  it('supprimé depuis un autre appareil : retiré ici, sauf si modifié ici depuis (alors recréé)', () => {
    const clean = merge(
      state('a', [withPlan('a', 'A', { serverVersion: 2 }), withPlan('b', 'B', { serverVersion: 1 })]),
      [record('b', 'B', 1)],
    );
    expect(clean.items.map((w) => w.id)).toEqual(['b']);
    expect(clean.activeId).toBe('b');
    const edited = merge(state('a', [withPlan('a', 'A', { serverVersion: 2, dirty: true })]), []);
    expect(edited.items[0]).toMatchObject({ id: 'a', dirty: true, serverVersion: undefined }); // sera recréé
  });

  it('des deux côtés : le serveur n’a pas avancé -> on garde la version d’ici', () => {
    const mine = withPlan('a', 'Mon nom', { serverVersion: 2, dirty: true });
    const s = merge(state('a', [mine]), [record('a', 'Ancien nom', 2)]);
    expect(s.items[0]).toMatchObject({ name: 'Mon nom', dirty: true, serverVersion: 2 });
  });

  it('des deux côtés : le serveur a avancé et rien n’a changé ici -> on prend le serveur', () => {
    const s = merge(state('a', [withPlan('a', 'Ancien', { serverVersion: 1 })]), [
      record('a', 'Nom venu de l’autre appareil', 2, '2026-11-18T12:00:00Z'),
    ]);
    expect(s.items[0]).toMatchObject({
      name: 'Nom venu de l’autre appareil',
      serverVersion: 2,
      dirty: false,
    });
  });

  it('modifié des deux côtés : le plus récent gagne', () => {
    const base = { serverVersion: 1, dirty: true };
    const mineNewer = merge(
      state('a', [withPlan('a', 'Mine', { ...base, updatedAt: '2026-11-18T13:00:00Z' })]),
      [record('a', 'Autre', 2, '2026-11-18T12:00:00Z')],
    );
    expect(mineNewer.items[0]).toMatchObject({ name: 'Mine', dirty: true, serverVersion: 2 }); // repartira avec la bonne base
    const theirsNewer = merge(
      state('a', [withPlan('a', 'Mine', { ...base, updatedAt: '2026-11-18T11:00:00Z' })]),
      [record('a', 'Autre', 2, '2026-11-18T12:00:00Z')],
    );
    expect(theirsNewer.items[0]).toMatchObject({ name: 'Autre', dirty: false, serverVersion: 2 });
  });

  it('l’espace vide jamais touché disparaît dès qu’on retrouve de vrais espaces, sinon il reste', () => {
    const blank = ws('blank', 'Espace 1');
    expect(merge(state('blank', [blank]), [record('a', 'A', 1)]).items.map((w) => w.id)).toEqual(['a']);
    expect(merge(state('blank', [blank]), []).items.map((w) => w.id)).toEqual(['blank']);
    const touched = ws('t', 'Espace 2', { updatedAt: '2026-11-18T10:05:00Z' });
    expect(
      merge(state('t', [touched]), [record('a', 'A', 1)])
        .items.map((w) => w.id)
        .sort(),
    ).toEqual(['a', 't']);
  });

  it('ordre stable d’un appareil à l’autre, espace actif corrigé, jamais de liste vide', () => {
    const s = merge(state('inconnu', [ws('z', 'Z', { createdAt: '2026-11-18T10:30:00Z' })]), [
      { ...record('b', 'B', 1), created_at: '2026-11-18T10:10:00Z' },
      { ...record('a', 'A', 1), created_at: '2026-11-18T10:20:00Z' },
    ]);
    expect(s.items.map((w) => w.id)).toEqual(['b', 'a', 'z']);
    expect(s.activeId).toBe('b');
    const empty = merge(state('a', [withPlan('a', 'A', { serverVersion: 1 })]), []);
    expect(empty.items).toEqual([expect.objectContaining({ id: 'neuf', plan: null })]);
  });
});

describe('espaces de travail : stockage local', () => {
  beforeEach(() => localStorage.clear());
  const ids = () => {
    let n = 0;
    return () => `id-${++n}`;
  };

  it('rien de gardé : un espace vide', () => {
    const s = loadWorkspaces('u1', ids(), () => NOW);
    expect(s.items).toHaveLength(1);
    expect(s.items[0]).toMatchObject({ name: 'Espace 1', plan: null, dirty: false });
    expect(s.pendingDeletes).toEqual([]);
  });

  it('aller-retour, rangé par utilisateur, avec la version du serveur et les suppressions en attente', () => {
    saveWorkspaces(
      'u1',
      state('b', [withPlan('a', 'A', { serverVersion: 2, dirty: true }), ws('b', 'B')], ['zzz']),
    );
    const back = loadWorkspaces('u1', ids(), () => NOW);
    expect(back.activeId).toBe('b');
    expect(back.pendingDeletes).toEqual(['zzz']);
    expect(back.items[0]).toMatchObject({ name: 'A', serverVersion: 2, dirty: true });
    expect(back.items[0].plan?.request.description).toBe('Une scène assez longue.');
    expect(loadWorkspaces('u2', ids(), () => NOW).items[0].name).toBe('Espace 1'); // autre compte : rien
  });

  it('espaces gardés avant la synchronisation : à envoyer une première fois', () => {
    localStorage.setItem(
      'pp-coach-workspaces-v1:u1',
      JSON.stringify({ activeId: 'a', items: [{ ...withPlan('a', 'A'), dirty: undefined }, ws('b', 'B')] }),
    );
    const s = loadWorkspaces('u1', ids(), () => NOW);
    expect(s.items.map((w) => w.dirty)).toEqual([true, false]);
  });

  it('reprend l’ancien plan unique (avant les espaces) comme premier espace, à envoyer', () => {
    savePlan('u1', plan('Un vieil homme boit son thé dans un café.'));
    const s = loadWorkspaces('u1', ids(), () => NOW);
    expect(s.items).toHaveLength(1);
    expect(s.items[0]).toMatchObject({ name: 'Un vieil homme boit son thé…', dirty: true });
  });

  it('contenu abîmé : entrées invalides et doublons retirés, espace actif corrigé', () => {
    localStorage.setItem(
      'pp-coach-workspaces-v1:u1',
      JSON.stringify({
        activeId: 'fantôme',
        items: [
          { id: 'a', name: 'A' },
          { id: 'a', name: 'Doublon' },
          { name: 'sans id' },
          42,
          { id: 'c', name: '  ' },
        ],
      }),
    );
    const s = loadWorkspaces('u1', ids(), () => NOW);
    expect(s.items.map((w) => w.id)).toEqual(['a']);
    expect(s.activeId).toBe('a');
    localStorage.setItem('pp-coach-workspaces-v1:u1', '{pas du json');
    expect(loadWorkspaces('u1', ids(), () => NOW).items).toHaveLength(1);
  });
});
