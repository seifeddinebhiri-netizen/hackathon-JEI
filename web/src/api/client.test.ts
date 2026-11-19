import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { request, setAuthTokenGetter, setUnauthorizedHandler } from './client';

function respond(status: number) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify({ code: 'non_autorise', message: 'Session invalide ou expirée.' }), {
          status,
        }),
    ),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  setAuthTokenGetter(() => null);
  setUnauthorizedHandler(() => {});
});

describe('401 du backend', () => {
  it('prévient le fournisseur d’authentification quand le jeton est refusé', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    setAuthTokenGetter(() => 'jeton-expire');
    respond(401);
    await expect(request('/projects/x', { schema: z.unknown() })).rejects.toMatchObject({
      code: 'non_autorise',
    });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('ne fait rien sans jeton (page publique) ni pour une autre erreur', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    respond(401);
    await expect(request('/festivals', { schema: z.unknown() })).rejects.toMatchObject({ status: 401 });
    setAuthTokenGetter(() => 'jeton');
    respond(403);
    await expect(request('/projects/x', { schema: z.unknown() })).rejects.toMatchObject({ status: 403 });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
