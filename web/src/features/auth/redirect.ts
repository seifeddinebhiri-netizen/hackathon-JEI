/** Page demandée avant la connexion, passée dans l'adresse : /connexion?suite=/planner/calendrier */
export const NEXT_PARAM = 'suite';
export const DEFAULT_NEXT = '/projet';

// Pages d'authentification : y revenir après la connexion n'aurait pas de sens.
const AUTH_PAGES = ['/connexion', '/mot-de-passe-oublie', '/nouveau-mot-de-passe'];

/**
 * N'accepte qu'un chemin interne à l'appli (« /planner?vue=semaine »). Tout le reste (adresse
 * complète, « //autre-site », « /\autre-site », schéma javascript:, caractères de contrôle) est
 * remplacé par la page par défaut : le paramètre ne peut pas servir à envoyer vers un autre site.
 */
export function safeNext(raw: string | null | undefined): string {
  if (!raw || raw.length > 2048) return DEFAULT_NEXT;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return DEFAULT_NEXT;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(raw)) return DEFAULT_NEXT;
  let url: URL;
  try {
    url = new URL(raw, 'https://encadre.invalid');
  } catch {
    return DEFAULT_NEXT;
  }
  if (url.origin !== 'https://encadre.invalid') return DEFAULT_NEXT;
  if (AUTH_PAGES.includes(url.pathname)) return DEFAULT_NEXT;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Adresse de la page de connexion qui ramènera à `next` (chemin interne) une fois connecté. */
export function loginPath(next?: string): string {
  const target = next ? safeNext(next) : DEFAULT_NEXT;
  return target === DEFAULT_NEXT ? '/connexion' : `/connexion?${NEXT_PARAM}=${encodeURIComponent(target)}`;
}

/** Adresse de retour du lien « nouveau mot de passe » (à autoriser dans Supabase > Auth > URL Configuration). */
export const resetPasswordRedirect = () => `${window.location.origin}/nouveau-mot-de-passe`;
