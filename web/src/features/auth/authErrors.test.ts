import { describe, expect, it } from 'vitest';
import { authErrorFromUrl, authErrorMessage } from './authErrors';

describe('messages de connexion en français', () => {
  it.each([
    // Codes Supabase (prioritaires, même si le texte anglais dit autre chose)
    [{ code: 'invalid_credentials', message: 'x', status: 400 }, 'Email ou mot de passe incorrect.'],
    [{ code: 'email_not_confirmed', status: 400 }, /pas encore confirmé/],
    [{ code: 'user_already_exists', status: 422 }, /Un compte existe déjà/],
    [{ code: 'weak_password', status: 422 }, /trop faible/],
    [{ code: 'over_request_rate_limit', status: 429 }, /Trop de tentatives/],
    [{ code: 'over_email_send_rate_limit', status: 429 }, /Trop d’emails/],
    [{ code: 'otp_expired', status: 403 }, /a expiré/],
    [{ code: 'same_password', status: 422 }, /différent de l’ancien/],
    // Réseau : aucune réponse du serveur
    [{ name: 'AuthRetryableFetchError', message: '{}', status: 0 }, /Impossible de joindre/],
    [{ message: 'Failed to fetch' }, /Impossible de joindre/],
    // Anciennes réponses sans code
    [{ message: 'Invalid login credentials' }, 'Email ou mot de passe incorrect.'],
    [{ message: 'Email not confirmed' }, /pas encore confirmé/],
    [{ message: 'User already registered' }, /Un compte existe déjà/],
    [{ message: 'Password should be at least 6 characters' }, /trop faible/],
    [{ message: 'x', status: 429 }, /Trop de tentatives/],
    [{ message: 'boom', status: 503 }, /rencontre un problème/],
  ])('%j', (error, expected) => {
    const msg = authErrorMessage(error);
    if (typeof expected === 'string') expect(msg).toBe(expected);
    else expect(msg).toMatch(expected);
  });

  it('cas imprévu : donne un indice au lieu de « Connexion impossible »', () => {
    expect(authErrorMessage({ code: 'nouveau_code', status: 400 })).toContain('(nouveau_code)');
    expect(authErrorMessage({ message: '?', status: 418 })).toContain('(statut 418)');
    expect(authErrorMessage({ message: '?' })).not.toMatch(/Connexion impossible/);
  });
});

describe('erreur au retour d’un lien envoyé par email', () => {
  it('lit le fragment (#error_code=…)', () => {
    expect(
      authErrorFromUrl(
        'https://app.test/nouveau-mot-de-passe#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
      ),
    ).toMatch(/a expiré/);
  });
  it('lit la requête (?error=…)', () => {
    expect(
      authErrorFromUrl(
        'https://app.test/nouveau-mot-de-passe?error=server_error&error_code=flow_state_expired',
      ),
    ).toMatch(/a expiré/);
  });
  it('rien quand le lien est bon', () => {
    expect(
      authErrorFromUrl('https://app.test/nouveau-mot-de-passe#access_token=x&type=recovery'),
    ).toBeUndefined();
  });
});
