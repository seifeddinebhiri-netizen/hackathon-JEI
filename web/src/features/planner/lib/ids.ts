/** Identifiant local (côté front) pour une scène, un lieu ou une personne créés à la main. */
export function localId(prefix: string): string {
  const r =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 10)
      : Math.random().toString(36).slice(2, 12);
  return `${prefix}-${r}`;
}

/** Prochain numéro de scène (« 8 » après « 7 »). */
export function nextSceneNumber(numbers: string[]): string {
  const max = numbers.reduce((m, n) => Math.max(m, parseInt(n, 10) || 0), 0);
  return String(max + 1);
}
