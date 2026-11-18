/**
 * Mesures sur l'image (petit échantillon de la caméra, calculé sur l'appareil).
 *
 * - luma : luminosité moyenne, 0 (noir) à 1 (blanc), sur l'image telle qu'affichée (sRGB).
 * - contrast : écart entre les 5 % les plus sombres et les 5 % les plus clairs, 0 à 1.
 * - clipHigh / clipLow : part de l'image brûlée (>98 %) ou bouchée (<2 %).
 * - warmth : log2(rouge / bleu) moyens. 0 = neutre, > 0 = tire vers le chaud (orange),
 *   < 0 = tire vers le froid (bleu). Hypothèse « monde gris » : c'est un indicateur, pas une
 *   température en kelvins.
 * - faceLuma / backgroundLuma : luminosité dans la zone du visage et en dehors (contre-jour).
 */
export type Box = { x: number; y: number; w: number; h: number }; // coordonnées normalisées 0..1

export type FrameStats = {
  luma: number;
  contrast: number;
  clipHigh: number;
  clipLow: number;
  warmth: number;
  faceLuma: number | null;
  backgroundLuma: number | null;
};

export function analyzeRgba(
  data: ArrayLike<number>,
  width: number,
  height: number,
  face: Box | null = null,
): FrameStats {
  const hist = new Uint32Array(256);
  let sumLuma = 0;
  let sumR = 0;
  let sumB = 0;
  let faceSum = 0;
  let faceN = 0;
  let bgSum = 0;
  let bgN = 0;
  const n = width * height;

  for (let i = 0; i < n; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    hist[Math.min(255, Math.round(l * 255))]++;
    sumLuma += l;
    sumR += r;
    sumB += b;
    if (face) {
      const px = ((i % width) + 0.5) / width;
      const py = (Math.floor(i / width) + 0.5) / height;
      if (px >= face.x && px <= face.x + face.w && py >= face.y && py <= face.y + face.h) {
        faceSum += l;
        faceN++;
      } else {
        bgSum += l;
        bgN++;
      }
    }
  }

  const percentile = (p: number) => {
    const target = p * n;
    let acc = 0;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc >= target) return v / 255;
    }
    return 1;
  };
  const above = (limit: number) => {
    let c = 0;
    for (let v = Math.ceil(limit * 255); v < 256; v++) c += hist[v];
    return c / n;
  };
  const below = (limit: number) => {
    let c = 0;
    for (let v = 0; v <= Math.floor(limit * 255); v++) c += hist[v];
    return c / n;
  };

  return {
    luma: sumLuma / n,
    contrast: percentile(0.95) - percentile(0.05),
    clipHigh: above(0.98),
    clipLow: below(0.02),
    warmth: Math.log2((sumR / n + 1) / (sumB / n + 1)),
    faceLuma: faceN > 0 ? faceSum / faceN : null,
    backgroundLuma: bgN > 0 ? bgSum / bgN : null,
  };
}
