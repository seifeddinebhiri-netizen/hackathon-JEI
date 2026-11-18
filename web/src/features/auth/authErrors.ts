/** Traduit une erreur Supabase en message français, sans détail technique. */
export function authErrorMessage(error: { message?: string; code?: string; status?: number }): string {
  const m = (error.message ?? '').toLowerCase();
  if (m.includes('invalid login')) return 'Email ou mot de passe incorrect.';
  if (m.includes('not confirmed'))
    return 'Confirme d’abord ton email (lien reçu par courriel), puis reconnecte-toi.';
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'Un compte existe déjà avec cet email.';
  if (m.includes('password') && m.includes('characters'))
    return 'Mot de passe trop court (6 caractères minimum).';
  if (error.status === 429 || m.includes('rate limit'))
    return 'Trop de tentatives. Réessaie dans un instant.';
  if (m.includes('fetch') || m.includes('network'))
    return 'Impossible de joindre le serveur de connexion. Vérifie ta connexion.';
  return 'Connexion impossible. Réessaie.';
}
