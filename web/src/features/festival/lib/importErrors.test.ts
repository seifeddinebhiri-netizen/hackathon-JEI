import { describe, expect, it } from 'vitest';
import { apiError, errorFromStatus } from '@/api/client';
import { AudioExtractError } from './audio';
import { subtitleImportError } from './importErrors';

describe('erreurs de l’import des sous-titres (en français, jamais de repli vers l’exemple)', () => {
  it('backend injoignable', () => {
    const r = subtitleImportError(apiError('reseau'));
    expect(r.title).toBe('Serveur de sous-titres injoignable');
    expect(r.message).toMatch(/Vérifie qu’il est lancé/);
  });

  it('clé ElevenLabs absente (503) : le message du serveur est affiché', () => {
    const r = subtitleImportError(
      errorFromStatus(503, 'La transcription n’est pas configurée sur ce serveur (clé ElevenLabs absente).'),
    );
    expect(r.title).toBe('Transcription indisponible sur le serveur');
    expect(r.message).toMatch(/ElevenLabs/);
  });

  it('fichier trop gros (413)', () => {
    const r = subtitleImportError(errorFromStatus(413, 'Fichier trop volumineux (maximum 200 Mo).'));
    expect(r.title).toBe('Fichier trop gros');
    expect(r.message).toMatch(/200 Mo.*extrait plus court/);
  });

  it('session expirée, projet d’un autre compte, son illisible', () => {
    expect(subtitleImportError(errorFromStatus(401)).title).toBe('Session expirée');
    expect(subtitleImportError(errorFromStatus(403)).message).toMatch(/introuvable sur ton compte/);
    expect(subtitleImportError(new AudioExtractError('Son illisible.')).title).toBe(
      'Le son n’a pas pu être extrait',
    );
  });
});
