/** Mots pour la chaleur de l'image (indicateur « monde gris », pas des kelvins). Seuils de départ. */
export function warmthWord(warmth: number): string {
  if (warmth > 0.15) return 'chaude';
  if (warmth < -0.15) return 'froide';
  return 'neutre';
}
