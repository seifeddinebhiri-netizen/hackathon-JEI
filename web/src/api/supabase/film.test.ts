import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeSupabase, type FakeResponse } from '@/test/fakeSupabase';

const holder = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('@/lib/supabase', () => ({
  get supabase() {
    return holder.client;
  },
  get hasRealAuth() {
    return !!holder.client;
  },
}));
vi.mock('@/lib/env', async (orig) => {
  const mod = await orig<typeof import('@/lib/env')>();
  return { env: { ...mod.env, publicAppUrl: 'https://encadre.test/' } };
});

const { getPublicFilm } = await import('./film');

const ID = '0b8f2a4e-1c3d-4e5f-8a9b-0c1d2e3f4a5b';
const ROW = {
  title: 'Dar Hmeti',
  director: 'Yassine',
  synopsis_short: 'Court.',
  synopsis_long: '',
  stills: ['/photos/ruelle.jpg'],
  credits: [{ role: 'Amira', name: '[Actrice 1]' }],
  trailer_url: null,
  passport_badge_code: 'EN-DRHM-T1',
};

function use(response: FakeResponse) {
  const f = fakeSupabase(undefined, { signedIn: false });
  f.client.rpc.mockResolvedValue(response);
  holder.client = f.client;
  return f.client;
}

describe('page film publique (fonction public_film, sans compte)', () => {
  beforeEach(() => {
    holder.client = null;
  });

  it('appelle public_film avec l’id du projet et construit le lien de vérification', async () => {
    const client = use({ data: [ROW], error: null });
    const film = await getPublicFilm(ID);
    expect(client.rpc).toHaveBeenCalledWith('public_film', { film_id: ID });
    expect(film).toEqual({
      id: ID,
      title: 'Dar Hmeti',
      director: 'Yassine',
      synopsis_short: 'Court.',
      synopsis_long: '',
      stills: ['/photos/ruelle.jpg'],
      credits: [{ role: 'Amira', name: '[Actrice 1]' }],
      passport_badge_code: 'EN-DRHM-T1',
      verify_url: 'https://encadre.test/verifier/EN-DRHM-T1',
    });
    expect(film).not.toHaveProperty('trailer_url'); // facultatif : absent plutôt que null
  });

  it('sans Passeport : ni code ni lien', async () => {
    use({ data: [{ ...ROW, passport_badge_code: null, trailer_url: 'https://video.test/ba' }], error: null });
    const film = await getPublicFilm(ID);
    expect(film.passport_badge_code).toBeUndefined();
    expect(film.verify_url).toBeUndefined();
    expect(film.trailer_url).toBe('https://video.test/ba');
  });

  it('aucune ligne : « Film introuvable » (404)', async () => {
    use({ data: [], error: null });
    await expect(getPublicFilm(ID)).rejects.toMatchObject({ code: 'introuvable', status: 404 });
  });

  it('identifiant qui n’est pas un uuid : 404 sans appeler la base', async () => {
    const client = use({ data: [ROW], error: null });
    await expect(getPublicFilm('demo-maree-basse')).rejects.toMatchObject({ code: 'introuvable' });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('migration absente : le dit clairement', async () => {
    use({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' }, status: 404 });
    await expect(getPublicFilm(ID)).rejects.toMatchObject({
      code: 'serveur',
      message: expect.stringMatching(/0008/),
    });
  });
});
