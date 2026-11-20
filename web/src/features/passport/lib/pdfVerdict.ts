import type { PdfVerification } from '@/api';

export type Verdict = {
  tone: 'ok' | 'warn' | 'bad';
  title: string;
  details: string[];
};

export const VERDICT_LIMIT =
  'La signature prouve que le fichier n’a pas changé et qui l’a émis. Elle ne prouve pas que les déclarations sont exactes.';

/**
 * Ce qu'il faut dire à un festival qui a déposé un PDF. Le verdict le plus rassurant n'est donné que si
 * TOUT est vrai : fichier intact, signé par nous, et identique au Passeport affiché. Dans tout autre cas,
 * on dit précisément ce qui cloche. `pageBadge` : le code du Passeport de la page où le PDF est déposé.
 */
export function verdictOf(r: PdfVerification, pageBadge?: string): Verdict {
  if (r.state === 'none') {
    return {
      tone: 'warn',
      title: 'Aucune signature',
      details: [
        'Ce PDF ne porte aucune signature C2PA. Il n’a pas été émis par notre serveur, ou sa signature a été retirée.',
      ],
    };
  }
  if (r.state === 'invalid') {
    return {
      tone: 'bad',
      title: 'Fichier modifié',
      details: [
        'Ce PDF a été modifié depuis sa signature, ou sa signature est cassée. Ne te fie pas à son contenu.',
      ],
    };
  }
  if (!r.issued_by_us) {
    return {
      tone: 'warn',
      title: 'Intact, mais pas signé par nous',
      details: [
        `Le fichier n’a pas été modifié, mais il n’a pas été signé par ce site${r.signer ? ` (signataire : ${r.signer})` : ''}. Ses informations ne sont pas garanties par nous.`,
      ],
    };
  }

  const testNote =
    r.signing_mode === 'test'
      ? [
          'Signature de démonstration : le certificat est un certificat de test, pas celui d’une autorité reconnue.',
        ]
      : [];
  if (pageBadge && r.badge_code && r.badge_code.toUpperCase() !== pageBadge.toUpperCase()) {
    return {
      tone: 'warn',
      title: 'Ce PDF est celui d’un autre Passeport',
      details: [`Il porte le code ${r.badge_code}, pas ${pageBadge}.`, ...testNote],
    };
  }
  if (r.matches_passport === true) {
    return {
      tone: 'ok',
      title: 'Authentique et à jour',
      details: ['Le fichier est intact, émis par ce site, et identique au Passeport actuel.', ...testNote],
    };
  }
  if (r.matches_passport === false) {
    return {
      tone: 'warn',
      title: 'Authentique, mais le Passeport a changé',
      details: [
        'Le fichier est intact et a bien été émis par ce site.',
        ...r.reasons,
        'Demande à l’équipe du film un PDF à jour.',
        ...testNote,
      ],
    };
  }
  return {
    tone: 'warn',
    title: 'Authentique, comparaison impossible',
    details: ['Le fichier est intact et a bien été émis par ce site.', ...r.reasons, ...testNote],
  };
}
