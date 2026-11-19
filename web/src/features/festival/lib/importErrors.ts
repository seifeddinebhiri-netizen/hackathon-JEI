/** Messages en français des échecs de l'import des sous-titres (jamais de repli vers l'exemple). */
import { isApiError } from '@/api/client';
import { env } from '@/lib/env';
import { AudioExtractError } from './audio';

/** Titre et message en français pour chaque échec de l'import (jamais de repli vers l'exemple). */
export function subtitleImportError(e: unknown): { title: string; message: string } {
  if (e instanceof AudioExtractError) return { title: 'Le son n’a pas pu être extrait', message: e.message };
  const title = 'Le brouillon n’a pas pu être créé';
  if (!isApiError(e)) return { title, message: e instanceof Error ? e.message : 'Erreur inattendue.' };
  switch (e.code) {
    case 'reseau':
      return {
        title: 'Serveur de sous-titres injoignable',
        message: `Le serveur ne répond pas (${env.apiUrl}). Vérifie qu’il est lancé, puis réessaie.`,
      };
    case 'delai_depasse':
      return {
        title,
        message: 'Le serveur met trop de temps à répondre. Réessaie avec un extrait plus court.',
      };
    case 'trop_volumineux':
      return {
        title: 'Fichier trop gros',
        message: `${e.message} Le son extrait dépasse la limite du serveur : essaie avec un extrait plus court.`,
      };
    case 'non_autorise':
      return { title: 'Session expirée', message: 'Reconnecte-toi, puis relance l’import.' };
    case 'interdit':
    case 'introuvable':
      return { title, message: 'Ce projet est introuvable sur ton compte : rouvre ton film puis réessaie.' };
    default:
      if (e.status === 503) return { title: 'Transcription indisponible sur le serveur', message: e.message };
      return { title, message: e.message };
  }
}
