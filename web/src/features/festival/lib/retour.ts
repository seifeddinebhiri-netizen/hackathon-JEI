/**
 * Paramètre `?retour=` du Passeport : seul un chemin interne du Kit Festival est accepté
 * (jamais une URL externe : pas de redirection ouverte).
 */
export function safeReturnPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v.startsWith('/festival/') && v !== '/festival') return null;
  if (v.startsWith('//') || v.includes('\\') || /[\s<>"]/.test(v)) return null;
  return v;
}

export function passportWithReturn(path: string): string {
  return `/passeport?retour=${encodeURIComponent(path)}`;
}
