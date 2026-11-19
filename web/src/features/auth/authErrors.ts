/**
 * Traduit une erreur Supabase Auth en message français qui dit la vraie raison.
 * On lit d'abord `code` (stable, documenté par Supabase), puis le statut, puis le texte anglais
 * (anciennes versions du serveur qui n'envoient pas de code).
 */
export type AuthErrorLike = { message?: string; code?: string; status?: number; name?: string };

const BY_CODE: Record<string, string> = {
  invalid_credentials: 'Email ou mot de passe incorrect.',
  email_not_confirmed:
    'Ton email n’est pas encore confirmé. Ouvre le lien reçu par courriel, puis reconnecte-toi.',
  user_already_exists:
    'Un compte existe déjà avec cet email. Connecte-toi ou utilise « Mot de passe oublié ».',
  email_exists: 'Un compte existe déjà avec cet email. Connecte-toi ou utilise « Mot de passe oublié ».',
  weak_password: 'Mot de passe trop faible : au moins 6 caractères, évite les mots de passe courants.',
  same_password: 'Choisis un mot de passe différent de l’ancien.',
  email_address_invalid: 'Cette adresse email n’est pas acceptée. Vérifie-la.',
  validation_failed: 'Email ou mot de passe mal formé. Vérifie ce que tu as saisi.',
  signup_disabled: 'La création de compte est fermée pour le moment.',
  email_provider_disabled: 'La connexion par email est désactivée pour le moment.',
  user_banned: 'Ce compte est suspendu.',
  user_not_found: 'Aucun compte ne correspond à cet email.',
  over_request_rate_limit: 'Trop de tentatives. Attends une minute avant de réessayer.',
  over_email_send_rate_limit:
    'Trop d’emails envoyés à cette adresse. Attends quelques minutes avant de réessayer.',
  otp_expired: 'Ce lien a expiré ou a déjà servi. Demande-en un nouveau.',
  flow_state_expired: 'Ce lien a expiré. Demande-en un nouveau.',
  flow_state_not_found: 'Ce lien n’est plus valable. Demande-en un nouveau.',
  session_expired: 'Ta session a expiré. Reconnecte-toi.',
  session_not_found: 'Ta session a expiré. Reconnecte-toi.',
  refresh_token_not_found: 'Ta session a expiré. Reconnecte-toi.',
  reauthentication_needed: 'Pour changer ton mot de passe, reconnecte-toi d’abord.',
};

const NETWORK = 'Impossible de joindre le serveur de connexion. Vérifie ta connexion internet.';

export function authErrorMessage(error: AuthErrorLike): string {
  const code = error.code ?? '';
  if (BY_CODE[code]) return BY_CODE[code];

  const m = (error.message ?? '').toLowerCase();
  // Pas de réponse du serveur : supabase-js renvoie AuthRetryableFetchError (statut 0) ou « Failed to fetch ».
  if (
    error.name === 'AuthRetryableFetchError' ||
    m.includes('failed to fetch') ||
    m.includes('network') ||
    m.includes('load failed')
  )
    return NETWORK;
  if (error.status === 429 || m.includes('rate limit')) return BY_CODE.over_request_rate_limit;

  if (m.includes('invalid login')) return BY_CODE.invalid_credentials;
  if (m.includes('not confirmed')) return BY_CODE.email_not_confirmed;
  if (m.includes('already registered') || m.includes('already been registered'))
    return BY_CODE.user_already_exists;
  if (m.includes('password') && m.includes('characters')) return BY_CODE.weak_password;
  if (m.includes('expired')) return BY_CODE.otp_expired;

  if (error.status && error.status >= 500)
    return 'Le service de connexion rencontre un problème. Réessaie dans quelques minutes.';
  // Cas non prévu : on garde un indice pour le support plutôt qu'un message vague.
  const hint = code || (error.status ? `statut ${error.status}` : '');
  return hint
    ? `Le service de connexion a refusé la demande (${hint}). Réessaie ou contacte l’équipe.`
    : 'Le service de connexion a refusé la demande. Réessaie ou contacte l’équipe.';
}

/** Erreur lue dans l'adresse au retour d'un lien envoyé par email (lien expiré, déjà utilisé…). */
export function authErrorFromUrl(href: string): string | undefined {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return undefined;
  }
  const params = new URLSearchParams(url.hash.replace(/^#/, ''));
  for (const [k, v] of url.searchParams) if (!params.has(k)) params.set(k, v);
  if (!params.has('error') && !params.has('error_code')) return undefined;
  return authErrorMessage({
    code: params.get('error_code') ?? undefined,
    message: params.get('error_description') ?? params.get('error') ?? undefined,
  });
}
