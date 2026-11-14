import type { AiPolicy, FestivalRequirement, ShortlistItem, SubtitleLine } from '@/api/types';
import type { ChipTone, IconName } from '@/components/ui';

export const AI_POLICY_LABELS: Record<AiPolicy, string> = {
  acceptee: 'IA acceptée',
  a_declarer: 'IA à déclarer',
  interdite: 'IA générative refusée',
};
export const AI_POLICY_TONES: Record<AiPolicy, ChipTone> = {
  acceptee: 'ok',
  a_declarer: 'warn',
  interdite: 'bad',
};
export const AI_POLICY_ICONS: Record<AiPolicy, IconName> = {
  acceptee: 'check',
  a_declarer: 'shield',
  interdite: 'x',
};

export const LANG_LABELS: Record<string, string> = { fr: 'Français', en: 'Anglais', ar: 'Arabe' };

export const REQUIREMENT_LABELS: Record<FestivalRequirement['kind'], string> = {
  format: 'Film au bon format et à la bonne durée',
  sous_titres: 'Sous-titres',
  synopsis: 'Synopsis',
  photos: 'Photos du film',
  affiche: 'Affiche',
  bande_annonce: 'Bande-annonce',
  bio: 'Biographie et filmographie',
  declaration_ia: 'Déclaration IA',
  droits_musique: 'Droits musicaux',
};

/** Outil de l'application qui prépare chaque élément du dossier (null : à faire hors de l'app). */
export const REQUIREMENT_TOOLS: Record<FestivalRequirement['kind'], { to: string; label: string } | null> = {
  format: null,
  sous_titres: { to: '/festival?onglet=sous-titres', label: 'Sous-titres' },
  synopsis: { to: '/festival?onglet=synopsis', label: 'Synopsis' },
  photos: { to: '/festival?onglet=page-film', label: 'Page film' },
  affiche: null,
  bande_annonce: { to: '/festival?onglet=page-film', label: 'Page film' },
  bio: null,
  declaration_ia: { to: '/passeport', label: 'Passeport IA' },
  droits_musique: null,
};

export const SHORTLIST_STATUS_LABELS: Record<ShortlistItem['status'], string> = {
  a_preparer: 'À préparer',
  pret: 'Prêt',
  soumis: 'Soumis',
};
export const SHORTLIST_STATUS_TONES: Record<ShortlistItem['status'], ChipTone> = {
  a_preparer: 'warn',
  pret: 'ok',
  soumis: 'dark',
};

export const CONFIDENCE_LABELS: Record<SubtitleLine['confidence'], string> = {
  elevee: 'Confiance élevée',
  moyenne: 'Confiance moyenne',
  faible: 'Confiance faible',
};
export const CONFIDENCE_TONES: Record<SubtitleLine['confidence'], ChipTone> = {
  elevee: 'ok',
  moyenne: 'warn',
  faible: 'bad',
};
export const CONFIDENCE_ICONS: Record<SubtitleLine['confidence'], IconName> = {
  elevee: 'check',
  moyenne: 'alert',
  faible: 'alert',
};

export const RANKING_DISCLAIMER =
  'Le classement indique la compatibilité avec les critères du festival. Il ne prédit pas la sélection.';
