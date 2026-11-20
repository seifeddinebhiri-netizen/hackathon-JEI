import { afterEach, describe, expect, it, vi } from 'vitest';
import { setAuthTokenGetter } from './client';
import { toAiTool } from './aiTools';
import { getAiToolRun, getAiTools, getPassportPdfUrl, resolveAiTool, verifyPassportPdf } from './endpoints';
import type { CatalogTool } from './schemas';

const row = (over: Partial<CatalogTool> = {}): CatalogTool => ({
  slug: 'claude',
  name: 'Claude',
  vendor: 'Anthropic',
  official_site: 'https://claude.ai',
  terms_url: 'https://www.anthropic.com/legal/consumer-terms',
  status: 'documente',
  review_state: 'verifie',
  research_state: 'complete',
  note_fr: 'Conditions différentes selon l’offre.',
  checked_at: '2026-11-19T10:00:00Z',
  ...over,
});

describe('fiche du catalogue → outil de l’interface', () => {
  it('l’identifiant est le slug, le fournisseur est le vendor', () => {
    expect(toAiTool(row())).toEqual({
      id: 'claude',
      name: 'Claude',
      provider: 'Anthropic',
      status: 'documente',
      note: 'Conditions différentes selon l’offre.',
      source_url: 'https://www.anthropic.com/legal/consumer-terms',
      checked_at: '2026-11-19T10:00:00Z',
      reviewed: true,
    });
  });

  it('sans statut calculé : « non évalué », jamais « non divulgué »', () => {
    const t = toAiTool(row({ status: null, research_state: 'incomplete_access', note_fr: '' }));
    expect(t.status).toBe('non_evalue');
    expect(t.note).toMatch(/n’ont pas pu être lues/);
  });

  it('une fiche non relue le dit ; sans conditions, la source retombe sur le site, puis sur rien', () => {
    expect(toAiTool(row({ review_state: 'a_verifier' })).reviewed).toBe(false);
    expect(toAiTool(row({ terms_url: null })).source_url).toBe('https://claude.ai');
    const bare = toAiTool(row({ terms_url: null, official_site: null, checked_at: null }));
    expect(bare.source_url).toBe('');
    expect(bare.checked_at).toBe('');
  });
});

function stubFetch(handler: (url: string, init: RequestInit) => Response) {
  const fetchMock = vi.fn(async (url: URL | string, init?: RequestInit) => handler(String(url), init ?? {}));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => {
  vi.unstubAllGlobals();
  setAuthTokenGetter(() => null);
});

describe('catalogue et recherche d’un outil', () => {
  it('GET /ai-tools : adapte chaque fiche', async () => {
    stubFetch(() =>
      json([row(), row({ slug: 'deepl', name: 'DeepL', status: null, research_state: 'none' })]),
    );
    const tools = await getAiTools();
    expect(tools.map((t) => [t.id, t.status])).toEqual([
      ['claude', 'documente'],
      ['deepl', 'non_evalue'],
    ]);
  });

  it('POST /ai-tools/resolve : outil connu → fiche ; outil absent → numéro de recherche', async () => {
    const f = stubFetch((url) =>
      url.endsWith('/ai-tools/resolve') && f.mock.calls.length === 1
        ? json({ state: 'found', tool: row() })
        : json({ state: 'researching', run_id: 'r1' }),
    );
    const found = await resolveAiTool('Claude');
    expect(found).toMatchObject({ state: 'found', tool: { id: 'claude' } });
    expect(JSON.parse(f.mock.calls[0][1]?.body as string)).toEqual({ name: 'Claude' });
    expect(await resolveAiTool('Pika')).toEqual({ state: 'researching', run_id: 'r1' });
  });

  it('GET /ai-tools/runs/{id} : état de la recherche, erreur incluse', async () => {
    stubFetch(() => json({ id: 'r1', state: 'failed', tool_slug: null, error: 'Outil non reconnu.' }));
    expect(await getAiToolRun('r1')).toEqual({
      id: 'r1',
      state: 'failed',
      tool_slug: undefined,
      error: 'Outil non reconnu.',
    });
  });
});

describe('PDF signé du Passeport', () => {
  it('POST /passports/{projet}/pdf avec le jeton ; renvoie une adresse locale et les infos de signature', async () => {
    setAuthTokenGetter(() => 'jeton');
    const create = vi.fn(() => 'blob:pdf-1');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create }));
    const f = stubFetch(
      () =>
        new Response(new Blob(['%PDF-1.4']), {
          headers: {
            'Content-Type': 'application/pdf',
            'X-C2PA-Simulated': 'true',
            'X-C2PA-Manifest-Id': 'urn:c2pa:abc',
          },
        }),
    );
    const r = await getPassportPdfUrl('p 1');
    expect(String(f.mock.calls[0][0])).toMatch(/\/passports\/p%201\/pdf$/);
    expect(f.mock.calls[0][1]).toMatchObject({ method: 'POST' });
    expect((f.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe('Bearer jeton');
    expect(r).toEqual({ url: 'blob:pdf-1', signed: true, simulated: true, manifest_id: 'urn:c2pa:abc' });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('signature réelle (certificat de production) : simulated = false', async () => {
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:x' }));
    stubFetch(() => new Response(new Blob(['%PDF']), { headers: { 'X-C2PA-Simulated': 'false' } }));
    expect((await getPassportPdfUrl('p1')).simulated).toBe(false);
  });

  it('erreurs du serveur : message français tel quel (signature non configurée, pas à toi, limite)', async () => {
    stubFetch(() =>
      json(
        { code: 'signature_indisponible', message: 'La signature C2PA n’est pas configurée sur le serveur.' },
        503,
      ),
    );
    await expect(getPassportPdfUrl('p1')).rejects.toMatchObject({
      code: 'serveur',
      message: 'La signature C2PA n’est pas configurée sur le serveur.',
    });
    stubFetch(() => json({ code: 'interdit', message: 'Ce projet ne t’appartient pas.' }, 403));
    await expect(getPassportPdfUrl('p1')).rejects.toMatchObject({ code: 'interdit' });
    stubFetch(() => json({ code: 'trop_de_requetes', message: 'Trop de requêtes.' }, 429));
    await expect(getPassportPdfUrl('p1')).rejects.toMatchObject({ code: 'trop_de_requetes' });
  });
});

describe('vérification publique d’un PDF', () => {
  const verdict = {
    state: 'valid',
    issued_by_us: true,
    signer: 'Premier Plan TEST Passeport IA',
    issuer: 'Premier Plan (CERTIFICAT DE TEST)',
    signing_mode: 'test',
    badge_code: 'EN-ABCD-23',
    film_title: 'Dar Hmeti',
    issued_at: '2026-11-19T12:00:00+00:00',
    tools: [{ slug: 'claude', status: 'documente', reviewed: true }],
    problems: [],
    matches_passport: true,
    reasons: [],
  };

  it('POST /verify/pdf : fichier envoyé en multipart, sans jeton nécessaire', async () => {
    const f = stubFetch(() => json(verdict));
    const file = new File(['%PDF-1.4'], 'passeport.pdf', { type: 'application/pdf' });
    const r = await verifyPassportPdf(file);
    expect(String(f.mock.calls[0][0])).toMatch(/\/verify\/pdf$/);
    const init = f.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect((init.body as FormData).get('file')).toBe(file);
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(r).toMatchObject({
      state: 'valid',
      issued_by_us: true,
      matches_passport: true,
      badge_code: 'EN-ABCD-23',
    });
  });

  it('les champs absents (null côté serveur) deviennent « inconnu » pour l’interface', async () => {
    stubFetch(() =>
      json({
        ...verdict,
        state: 'none',
        issued_by_us: false,
        signer: null,
        signing_mode: null,
        badge_code: null,
        matches_passport: null,
        tools: [],
      }),
    );
    const r = await verifyPassportPdf(new File(['%PDF'], 'a.pdf'));
    expect(r.matches_passport).toBeUndefined();
    expect(r.signer).toBeUndefined();
    expect(r.badge_code).toBeUndefined();
  });

  it('refus du serveur : message français (pas un PDF, trop volumineux, limite par adresse)', async () => {
    stubFetch(() => json({ code: 'pas_un_pdf', message: 'Ce fichier n’est pas un PDF.' }, 422));
    await expect(verifyPassportPdf(new File(['x'], 'a.pdf'))).rejects.toMatchObject({
      code: 'invalide',
      message: 'Ce fichier n’est pas un PDF.',
    });
    stubFetch(() => json({ code: 'trop_volumineux', message: 'Fichier trop volumineux.' }, 413));
    await expect(verifyPassportPdf(new File(['x'], 'a.pdf'))).rejects.toMatchObject({
      code: 'trop_volumineux',
    });
    stubFetch(() => json({ code: 'trop_de_requetes', message: 'Trop de requêtes.' }, 429));
    await expect(verifyPassportPdf(new File(['x'], 'a.pdf'))).rejects.toMatchObject({
      code: 'trop_de_requetes',
    });
  });
});
