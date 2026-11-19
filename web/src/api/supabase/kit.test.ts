import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeSupabase, has, type FakeCall, type FakeResponse } from '@/test/fakeSupabase';

const holder = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('@/lib/supabase', () => ({
  get supabase() {
    return holder.client;
  },
  get hasRealAuth() {
    return !!holder.client;
  },
}));

const { supabaseKitApi } = await import('./kit');
const { supabasePassportApi } = await import('./passport');
const { isApiError } = await import('../client');

function use(respond?: (c: FakeCall) => FakeResponse, opts?: { signedIn?: boolean }) {
  const f = fakeSupabase(respond, opts);
  holder.client = f.client;
  return f;
}

const FILM = {
  duration_min: 15,
  language: 'Derja',
  genre: 'Fiction',
  synopsis_phrase: 'Une phrase.',
  synopsis_court: 'Court.',
  synopsis_long: '',
  synopsis_en: { court: { text: 'Short.', source: 'Court.', validated: true } },
  stills: ['/photos/ruelle.jpg'],
  trailer_url: null,
};

describe('Kit Festival dans Supabase', () => {
  beforeEach(() => {
    holder.client = null;
  });

  it('lit dossiers, pièces et champs du film du projet', async () => {
    const f = use((c) =>
      c.table === 'festival_dossiers'
        ? {
            data: [
              { festival_id: 'bsff-next-generation', status: 'a_preparer', ai_choice: null },
              { festival_id: 'vienna-shorts', status: 'pret', ai_choice: 'outil_technique' },
            ],
            error: null,
          }
        : c.table === 'kit_pieces'
          ? { data: [{ piece_key: 'format:vienna-shorts', state: 'pret' }], error: null }
          : { data: FILM, error: null },
    );
    const kit = await supabaseKitApi.getKit('p1');
    expect(kit.dossiers).toEqual([
      { festival_id: 'bsff-next-generation', status: 'a_preparer', ai_choice: null },
      { festival_id: 'vienna-shorts', status: 'pret', ai_choice: 'outil_technique' },
    ]);
    expect(kit.pieces).toEqual({ 'format:vienna-shorts': 'pret' });
    expect(kit.synopsis).toEqual({ phrase: 'Une phrase.', court: 'Court.', long: '' });
    expect(kit.film_profile).toEqual({ duration_min: 15, language: 'Derja', genre: 'Fiction' });
    expect(kit.film_page).toEqual({ stills: ['/photos/ruelle.jpg'] });
    expect(kit.synopsis_en?.court?.validated).toBe(true);
    // Toujours filtré sur le projet (la RLS filtre en plus sur le propriétaire)
    for (const c of f.calls) expect(c.ops).toContainEqual(['eq', ['project_id', 'p1']]);
  });

  it('projet sans données du Kit : listes vides, champs absents', async () => {
    use((c) => ({ data: c.table === 'film_kits' ? null : [], error: null }));
    const kit = await supabaseKitApi.getKit('p1');
    expect(kit).toEqual({ project_id: 'p1', dossiers: [], pieces: {} });
  });

  it('une pièce est une seule ligne par projet (pas de copie par dossier), owner_id laissé au défaut', async () => {
    const f = use(() => ({ data: null, error: null }));
    await supabaseKitApi.setPiece('p1', 'affiche', 'pret');
    expect(f.calls).toHaveLength(1);
    const [row, opts] = f.argsOf('kit_pieces', 'upsert')!;
    expect(row).toEqual({ project_id: 'p1', piece_key: 'affiche', state: 'pret' });
    expect(opts).toEqual({ onConflict: 'project_id,piece_key' });
  });

  it('ajoute un dossier à la suite, sans doublon', async () => {
    const f = use((c) =>
      has(c, 'upsert') ? { data: null, error: null } : { data: [{ position: 2 }], error: null },
    );
    await supabaseKitApi.addDossier('p1', {
      festival_id: 'clermont-international',
      status: 'prochain_appel',
    });
    const [row, opts] = f.argsOf('festival_dossiers', 'upsert')!;
    expect(row).toMatchObject({ project_id: 'p1', festival_id: 'clermont-international', position: 3 });
    expect(row).not.toHaveProperty('owner_id');
    expect(opts).toEqual({ onConflict: 'project_id,festival_id', ignoreDuplicates: true });
  });

  it('enregistre seulement les champs du film envoyés', async () => {
    const f = use(() => ({ data: FILM, error: null }));
    await supabaseKitApi.saveFilm('p1', { synopsis: { phrase: 'a', court: 'b', long: 'c' } });
    const [row] = f.argsOf('film_kits', 'upsert')!;
    expect(row).toEqual({ project_id: 'p1', synopsis_phrase: 'a', synopsis_court: 'b', synopsis_long: 'c' });
  });

  it('exige un compte connecté', async () => {
    use(undefined, { signedIn: false });
    const e = await supabaseKitApi.getKit('p1').catch((x: unknown) => x);
    expect(isApiError(e) && e.code).toBe('non_autorise');
    expect((e as Error).message).toBe('Connecte-toi pour utiliser le Kit Festival.');
  });

  it('traduit les erreurs Supabase en français', async () => {
    use(() => ({
      data: null,
      error: { code: '42501', message: 'new row violates row-level security policy' },
    }));
    let e = await supabaseKitApi.setPiece('p1', 'bio', 'pret').catch((x: unknown) => x);
    expect(isApiError(e) && e.code).toBe('interdit');
    expect((e as Error).message).not.toMatch(/row-level/);

    use(() => ({ data: null, error: { code: '', message: 'TypeError: Failed to fetch' } }));
    e = await supabaseKitApi.setPiece('p1', 'bio', 'pret').catch((x: unknown) => x);
    expect(isApiError(e) && e.code).toBe('reseau');

    use(() => ({ data: null, error: { code: '42P01', message: 'relation "kit_pieces" does not exist' } }));
    e = await supabaseKitApi.setPiece('p1', 'bio', 'pret').catch((x: unknown) => x);
    expect((e as Error).message).toMatch(/migration 0005/);
  });
});

describe('Passeport IA dans Supabase', () => {
  it('/verifier : verify_badge renvoie seulement les champs publics', async () => {
    const f = use();
    f.client.rpc.mockResolvedValueOnce({
      data: [{ film_title: 'Dar Hmeti', director: 'Yassine', declarations: [], c2pa_signed: true }],
      error: null,
    });
    const r = await supabasePassportApi.verifyPassport('en-drhm-t1');
    expect(f.client.rpc).toHaveBeenCalledWith('verify_badge', { code: 'en-drhm-t1' });
    expect(r.passport).toMatchObject({
      film_title: 'Dar Hmeti',
      director: 'Yassine',
      badge_code: 'EN-DRHM-T1',
    });
    expect(r.signature.signed).toBe(true);
  });

  it('/verifier : code inconnu → introuvable', async () => {
    use();
    const e = await supabasePassportApi.verifyPassport('EN-XXXX-00').catch((x: unknown) => x);
    expect(isApiError(e) && e.code).toBe('introuvable');
  });

  it('nouveau Passeport : seuls titre, réalisation et déclarations sont envoyés ; le code vient de la base', async () => {
    const row = {
      project_id: 'p1',
      film_title: 'Dar Hmeti',
      director: 'Yassine',
      declarations: [],
      c2pa_signed: false,
      badge_code: 'EN-ABCD-23',
      updated_at: '2026-11-19T10:00:00Z',
    };
    const f = use((c) => (has(c, 'insert') ? { data: row, error: null } : { data: null, error: null }));
    const p = await supabasePassportApi.savePassport({
      project_id: 'p1',
      film_title: 'Dar Hmeti',
      director: 'Yassine',
      declarations: [],
    });
    const [inserted] = f.argsOf('ai_passports', 'insert')! as [Record<string, unknown>];
    // Migration 0007 : le navigateur n'a pas le droit d'écrire badge_code ni c2pa_signed.
    expect(Object.keys(inserted).sort()).toEqual(['declarations', 'director', 'film_title', 'project_id']);
    expect(p.badge_code).toBe('EN-ABCD-23');
    expect(p.verify_url).toMatch(/\/verifier\/EN-ABCD-23$/);
  });

  it('mise à jour : jamais badge_code ni c2pa_signed', async () => {
    const row = {
      project_id: 'p1',
      film_title: 'Dar Hmeti',
      director: 'Yassine',
      declarations: [],
      c2pa_signed: false,
      badge_code: 'EN-ABCD-23',
      updated_at: '2026-11-19T10:00:00Z',
    };
    const f = use(() => ({ data: row, error: null }));
    await supabasePassportApi.savePassport({
      project_id: 'p1',
      film_title: 'Dar Hmeti 2',
      director: 'Yassine',
      declarations: [],
    });
    const [updated] = f.argsOf('ai_passports', 'update')! as [Record<string, unknown>];
    expect(Object.keys(updated).sort()).toEqual(['declarations', 'director', 'film_title']);
  });

  it('signature C2PA de démonstration : annoncée simulée, rien n’est écrit', async () => {
    const row = {
      project_id: 'p1',
      film_title: 'Dar Hmeti',
      director: 'Yassine',
      declarations: [],
      c2pa_signed: false,
      badge_code: 'EN-ABCD-23',
      updated_at: '2026-11-19T10:00:00Z',
    };
    const f = use(() => ({ data: row, error: null }));
    const r = await supabasePassportApi.signC2pa({ passport_id: 'p1', file_name: 'film.mp4' });
    expect(r).toMatchObject({ signed: true, simulated: true, manifest_id: 'c2pa-EN-ABCD-23' });
    expect(f.calls.some((c) => has(c, 'update') || has(c, 'insert') || has(c, 'upsert'))).toBe(false);
  });
});
