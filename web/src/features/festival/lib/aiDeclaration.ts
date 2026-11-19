/**
 * Déclaration IA d'un dossier : la case proposée est calculée par le code à partir du Passeport
 * (niveaux d'usage), puis présentée comme une proposition à valider par l'auteur.
 */
import type { AiChoice, Passport } from '@/api/types';

export type { AiChoice };

export const AI_CHOICE_LABELS: Record<AiChoice, string> = {
  aucune: 'Pas d’IA dans le film',
  outil_technique: 'IA comme outil technique',
  generation: 'IA pour générer des images ou du contenu artistique',
  les_deux: 'Les deux',
};

const DEPT_LABELS: Record<Passport['declarations'][number]['department'], string> = {
  scenario: 'Scénario',
  image: 'Image',
  montage: 'Montage',
  son_voix: 'Son',
  musique: 'Musique',
  vfx: 'Effets visuels',
  sous_titres: 'Sous-titres',
  affiche_promo: 'Affiche',
};
export function deptLabel(d: Passport['declarations'][number]['department']): string {
  return DEPT_LABELS[d];
}

export function usage(p: Passport) {
  const used = p.declarations.filter((d) => d.used_ai);
  return {
    used,
    technical: used.filter((d) => d.level === 'assistance' || !d.level),
    generative: used.filter((d) => d.level === 'generation_partielle' || d.level === 'generation_complete'),
  };
}

export function proposeChoice(p: Passport): AiChoice {
  const { used, technical, generative } = usage(p);
  if (!used.length) return 'aucune';
  if (generative.length && technical.length) return 'les_deux';
  return generative.length ? 'generation' : 'outil_technique';
}

/** Explication d'une case au regard du Passeport (pourquoi elle convient ou non). */
export function choiceHint(choice: AiChoice, p: Passport): string {
  const { used, technical, generative } = usage(p);
  const n = used.length;
  switch (choice) {
    case 'aucune':
      return n
        ? `Faux pour toi : ton Passeport déclare ${n} usage${n > 1 ? 's' : ''}.`
        : 'Ton Passeport ne déclare aucune IA.';
    case 'outil_technique':
      return technical.length
        ? `Montage, son, sous-titrage, upscaling… Ton Passeport : ${technical.map((d) => deptLabel(d.department).toLowerCase()).join(', ')}.`
        : 'Sous-titrage, nettoyage du son, upscaling.';
    case 'generation':
      return generative.length
        ? `Ton Passeport déclare du contenu généré : ${generative.map((d) => deptLabel(d.department).toLowerCase()).join(', ')}.`
        : 'Rien de généré dans ton Passeport.';
    case 'les_deux':
      return technical.length && generative.length ? 'Ton Passeport déclare les deux.' : 'Pas ton cas.';
  }
}

/** Phrase « Pourquoi cette case » à partir des déclarations. */
export function whyChoice(p: Passport): string {
  const { used, generative } = usage(p);
  if (!used.length) return 'Ton Passeport ne déclare aucun usage de l’IA.';
  const what = used.map(
    (d) =>
      `${deptLabel(d.department).toLowerCase()} (${d.what.trim().replace(/\.$/, '').toLowerCase() || 'usage déclaré'})`,
  );
  return generative.length
    ? `Ton Passeport déclare : ${what.join(', ')}. Une partie du contenu a été générée.`
    : `Ton Passeport déclare : ${what.join(', ')}. Ce sont des usages techniques : aucune image ni aucun son n’a été généré.`;
}
