import { afterEach, expect, it, vi } from 'vitest';
import { analyzeScenario } from './api';
import { DEMO, EXAMPLE_CONTENT } from './demo';

afterEach(() => vi.unstubAllGlobals());

it('sends JSON to FastAPI and validates the actual HTTP response', async () => {
  const transport = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ ...DEMO, simulated: false }), { status: 200 }));
  vi.stubGlobal('fetch', transport);
  const result = await analyzeScenario({ title: DEMO.title, content: EXAMPLE_CONTENT });
  const [url, options] = transport.mock.calls[0];
  expect(new URL(url).pathname).toBe('/scenarios/analyze');
  expect(options.method).toBe('POST');
  expect(JSON.parse(options.body)).toEqual({ title: DEMO.title, content: EXAMPLE_CONTENT });
  expect(result.simulated).toBe(false);
});

it('shows the backend error envelope and rejects malformed responses', async () => {
  const transport = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: { code: 'llm_unavailable', message: 'Vérifiez la clé côté serveur.' } }),
        { status: 503 },
      ),
    )
    .mockResolvedValueOnce(new Response(JSON.stringify({ scenes: [] }), { status: 200 }));
  vi.stubGlobal('fetch', transport);
  await expect(analyzeScenario({ title: DEMO.title, content: EXAMPLE_CONTENT })).rejects.toThrow(
    'Vérifiez la clé côté serveur.',
  );
  await expect(analyzeScenario({ title: DEMO.title, content: EXAMPLE_CONTENT })).rejects.toMatchObject({
    code: 'reponse_invalide',
  });
});
