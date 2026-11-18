/**
 * Vidéo choisie par l'utilisateur pour « Regarder et valider ».
 * Gardée en mémoire le temps de la visite seulement : jamais envoyée, jamais stockée
 * (un rechargement de la page l'oublie).
 */
let current: File | null = null;

export function setSessionVideo(file: File | null): void {
  current = file;
}

export function getSessionVideo(): File | null {
  return current;
}
