import type { Box } from './imageStats';

/**
 * Position du visage dans l'image. On DÉTECTE un visage (où est-il ?), on ne le RECONNAÎT jamais :
 * aucune identification, rien n'est stocké.
 */
export type FaceMetrics = {
  /** Centre du visage, 0 (gauche / haut) à 1 (droite / bas). */
  centerX: number;
  centerY: number;
  /** Hauteur du visage / hauteur de l'image. */
  height: number;
  /** Espace estimé entre le haut de la tête et le haut de l'image (part de la hauteur de l'image). */
  headroom: number;
};

/**
 * La boîte du détecteur va du front au menton ; la tête (cheveux) dépasse au-dessus.
 * Valeur de départ v0 (part de la hauteur du visage), à calibrer sur le terrain.
 */
export const HEAD_TOP_OVER_FACE = 0.3;

export function faceMetrics(box: Box): FaceMetrics {
  return {
    centerX: box.x + box.w / 2,
    centerY: box.y + box.h / 2,
    height: box.h,
    headroom: Math.max(0, box.y - HEAD_TOP_OVER_FACE * box.h),
  };
}

/** Le visage principal = la plus grande boîte. */
export function pickMainFace(boxes: Box[]): Box | null {
  return boxes.reduce<Box | null>((best, b) => (!best || b.w * b.h > best.w * best.h ? b : best), null);
}
