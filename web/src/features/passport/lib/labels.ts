import type { AiToolStatus, Department, DepartmentDeclaration, UsageLevel } from '@/api/types';
import type { ChipTone } from '@/components/ui';

export const DEPARTMENTS: Department[] = [
  'scenario',
  'image',
  'montage',
  'son_voix',
  'musique',
  'vfx',
  'sous_titres',
  'affiche_promo',
];

export const DEPARTMENT_LABELS: Record<Department, string> = {
  scenario: 'Scénario',
  image: 'Image et tournage',
  montage: 'Montage',
  son_voix: 'Son et voix',
  musique: 'Musique',
  vfx: 'Effets visuels',
  sous_titres: 'Sous-titres et traduction',
  affiche_promo: 'Affiche et promotion',
};

export const USAGE_LABELS: Record<UsageLevel, string> = {
  assistance: 'Assistance',
  generation_partielle: 'Génération partielle',
  generation_complete: 'Génération complète',
};

export const USAGE_HINTS: Record<UsageLevel, string> = {
  assistance: 'L’IA a aidé, l’humain a créé.',
  generation_partielle: 'Une partie du contenu a été générée par l’IA.',
  generation_complete: 'Le contenu a été généré par l’IA.',
};

export const TOOL_STATUS_LABELS: Record<AiToolStatus, string> = {
  documente: 'Documenté',
  partiel: 'Partiel',
  non_divulgue: 'Non divulgué',
};

export const TOOL_STATUS_TONES: Record<AiToolStatus, ChipTone> = {
  documente: 'ok',
  partiel: 'warn',
  non_divulgue: 'bad',
};

/** Classe d'un département pour l'Étiquette IA. */
export type LabelClass = 'humain' | 'assiste' | 'genere';

export function classify(d: DepartmentDeclaration | undefined): LabelClass | undefined {
  if (!d) return undefined;
  if (!d.used_ai) return 'humain';
  return d.level === 'assistance' ? 'assiste' : 'genere';
}

export function summarize(declarations: DepartmentDeclaration[]) {
  const counts = { humain: 0, assiste: 0, genere: 0, non_renseigne: 0 };
  for (const dep of DEPARTMENTS) {
    const c = classify(declarations.find((d) => d.department === dep));
    if (c) counts[c]++;
    else counts.non_renseigne++;
  }
  return counts;
}

export const LABEL_DISCLAIMER =
  'Déclaration fondée sur la documentation publique des outils. Ce n’est pas un avis juridique.';

export const DEPARTMENT_HINTS: Record<Department, string> = {
  scenario: 'Écriture, structure, dialogues, recherche.',
  image: 'Prise de vue, éclairage, images générées.',
  montage: 'Découpage, rythme, étalonnage.',
  son_voix: 'Prise de son, nettoyage, voix de synthèse, doublage.',
  musique: 'Composition, arrangements, musique générée.',
  vfx: 'Effets, incrustations, retouches d’image.',
  sous_titres: 'Transcription, traduction, sous-titrage.',
  affiche_promo: 'Affiche, bande-annonce, visuels de promotion.',
};

export const TOOL_STATUS_HELP =
  'Ce statut décrit ce que le fournisseur de l’outil publie sur ses données d’entraînement et ses droits. Ce n’est pas un jugement sur ton travail. « Non divulgué » est un statut valide.';

export type DeclarationState = 'vide' | 'humain' | 'ia_complet' | 'ia_incomplet';

/** État d'une déclaration pour la navigation (icône + libellé). */
export function declarationState(d: DepartmentDeclaration | undefined): DeclarationState {
  if (!d) return 'vide';
  if (!d.used_ai) return 'humain';
  return (d.tool_id || d.custom_tool?.trim()) && d.what.trim() && d.level ? 'ia_complet' : 'ia_incomplet';
}
