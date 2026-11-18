import { describe, expect, it } from 'vitest';
import { authErrorMessage } from './authErrors';

describe('messages de connexion en français', () => {
  it.each([
    [{ message: 'Invalid login credentials' }, 'Email ou mot de passe incorrect.'],
    [
      { message: 'Email not confirmed' },
      'Confirme d’abord ton email (lien reçu par courriel), puis reconnecte-toi.',
    ],
    [{ message: 'User already registered' }, 'Un compte existe déjà avec cet email.'],
    [
      { message: 'Password should be at least 6 characters' },
      'Mot de passe trop court (6 caractères minimum).',
    ],
    [{ message: 'x', status: 429 }, 'Trop de tentatives. Réessaie dans un instant.'],
    [{ message: 'Failed to fetch' }, 'Impossible de joindre le serveur de connexion. Vérifie ta connexion.'],
    [{ message: 'quelque chose d’inattendu' }, 'Connexion impossible. Réessaie.'],
  ])('%j', (error, expected) => expect(authErrorMessage(error)).toBe(expected));
});
