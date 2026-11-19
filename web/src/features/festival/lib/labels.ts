import type { AiPolicy, DeadlineStatus, ShortlistStatus, SubtitleLine, SubtitleRule } from '@/api/types';
import type { ChipTone, IconName } from '@/components/ui';

export const AI_POLICY_LABELS: Record<AiPolicy, string> = {
  acceptee: 'IA acceptée',
  a_declarer: 'IA à déclarer',
  interdite: 'IA générative refusée',
  section_dediee: 'Section IA à part',
  non_precisee: 'Règlement muet sur l’IA',
};
export const AI_POLICY_TONES: Record<AiPolicy, ChipTone> = {
  acceptee: 'ok',
  a_declarer: 'warn',
  interdite: 'bad',
  section_dediee: 'warn',
  non_precisee: 'neutral',
};
export const AI_POLICY_ICONS: Record<AiPolicy, IconName> = {
  acceptee: 'check',
  a_declarer: 'shield',
  interdite: 'x',
  section_dediee: 'layers',
  non_precisee: 'info',
};

export const DEADLINE_LABELS: Record<DeadlineStatus, string> = {
  ouverte: 'Appel ouvert',
  a_confirmer: 'Date à confirmer',
  passee: 'Appel clos',
};
export const DEADLINE_TONES: Record<DeadlineStatus, ChipTone> = {
  ouverte: 'ok',
  a_confirmer: 'warn',
  passee: 'neutral',
};
export const DEADLINE_ICONS: Record<DeadlineStatus, IconName> = {
  ouverte: 'clock',
  a_confirmer: 'info',
  passee: 'lock',
};

export const LANG_LABELS: Record<string, string> = { fr: 'Français', en: 'Anglais', ar: 'Arabe' };
export function langList(langs: string[]): string {
  return langs.length ? langs.map((l) => LANG_LABELS[l] ?? l).join(', ') : 'Non précisé';
}

export const SHORTLIST_STATUS_LABELS: Record<ShortlistStatus, string> = {
  a_preparer: 'En préparation',
  pret: 'Prêt à soumettre',
  soumis: 'Soumis sur le site officiel',
  reponse_recue: 'Réponse reçue',
  prochain_appel: 'Pour le prochain appel',
};
export const SHORTLIST_STATUS_TONES: Record<ShortlistStatus, ChipTone> = {
  a_preparer: 'warn',
  pret: 'ok',
  soumis: 'dark',
  reponse_recue: 'neutral',
  prochain_appel: 'neutral',
};
export const SHORTLIST_STATUS_ICONS: Record<ShortlistStatus, IconName> = {
  a_preparer: 'edit',
  pret: 'check',
  soumis: 'external',
  reponse_recue: 'doc',
  prochain_appel: 'calendar',
};
export const SHORTLIST_STATUSES = Object.keys(SHORTLIST_STATUS_LABELS) as ShortlistStatus[];

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

export const RULE_LABELS: Record<SubtitleRule, string> = {
  lecture_rapide: 'Trop rapide à lire',
  trop_de_lignes: 'Trop de lignes',
  ligne_trop_longue: 'Ligne trop longue',
  duree_courte: 'Affichée trop peu de temps',
  duree_longue: 'Affichée trop longtemps',
  chevauchement: 'Trop proche de la ligne précédente',
  omission_possible: 'Traduction peut-être incomplète',
};

export const RANKING_DISCLAIMER =
  'La compatibilité compare ton film au règlement écrit. Elle ne prédit pas la sélection.';

/** Régions du catalogue : dérivées du pays (le backend n'a pas de champ région). */
export type Region = 'afrique' | 'arabe' | 'europe';
export const REGION_LABELS: Record<Region | 'toutes', string> = {
  toutes: 'Toutes',
  afrique: 'Maghreb & Afrique',
  arabe: 'Monde arabe',
  europe: 'Europe',
};
const REGION_BY_COUNTRY: Record<string, Region> = {
  tunisie: 'afrique',
  maroc: 'afrique',
  algerie: 'afrique',
  'burkina faso': 'afrique',
  senegal: 'afrique',
  "cote d'ivoire": 'afrique',
  egypte: 'arabe',
  liban: 'arabe',
  jordanie: 'arabe',
  'emirats arabes unis': 'arabe',
  'arabie saoudite': 'arabe',
  qatar: 'arabe',
  france: 'europe',
  belgique: 'europe',
  autriche: 'europe',
  suisse: 'europe',
  allemagne: 'europe',
  italie: 'europe',
  espagne: 'europe',
  'pays-bas': 'europe',
};
export function regionOf(country: string): Region | null {
  const k = country.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/’/g, "'").trim();
  return REGION_BY_COUNTRY[k] ?? null;
}
