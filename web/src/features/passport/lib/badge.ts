import { brand } from '@/app/brand';

/**
 * Badge « Passeport IA » à mettre au générique ou sur l'affiche.
 * Reprend les codes du logo : coins de viseur rouges et carré rouge en bas à droite.
 * SVG autonome (polices système) pour qu'il se rende pareil partout, y compris converti en PNG.
 */
export function badgeSvg({
  code,
  verifyHost,
  light = false,
}: {
  code: string;
  verifyHost: string;
  light?: boolean;
}): string {
  const W = 480;
  const H = 160;
  const bg = light ? '#FFFFFF' : brand.colors.background;
  const fg = light ? brand.colors.background : brand.colors.text;
  const red = brand.colors.mark;
  // Sur fond clair, l'accent passe au rouge (comme le « é » du logo clair)
  const accent = light ? red : brand.colors.accent;
  const muted = light ? '#55524C' : '#B8B4AC';
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const m = 12; // marge du viseur
  const arm = 34; // longueur des coins
  const t = 4; // épaisseur des coins
  const sq = 18; // carré rouge
  const corners = [
    // haut gauche
    `<rect x="${m}" y="${m}" width="${arm}" height="${t}"/><rect x="${m}" y="${m}" width="${t}" height="${arm}"/>`,
    // haut droite
    `<rect x="${W - m - arm}" y="${m}" width="${arm}" height="${t}"/><rect x="${W - m - t}" y="${m}" width="${t}" height="${arm}"/>`,
    // bas gauche
    `<rect x="${m}" y="${H - m - t}" width="${arm}" height="${t}"/><rect x="${m}" y="${H - m - arm}" width="${t}" height="${arm}"/>`,
  ].join('');
  const fit = (len: number, max: number) =>
    len > max ? ` textLength="${max * 9.5}" lengthAdjust="spacingAndGlyphs"` : '';
  const verify = `Vérifier : ${verifyHost}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${bg}"/>
  <g fill="${red}">${corners}<rect x="${W - m - sq}" y="${H - m - sq}" width="${sq}" height="${sq}"/></g>
  <text x="44" y="58" font-family="'Courier New', monospace" font-weight="700" font-size="15" letter-spacing="2" fill="${accent}">PASSEPORT IA<tspan fill="${muted}" font-weight="400"> · ${esc(brand.name)}.</tspan></text>
  <text x="44" y="100" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="38" fill="${fg}">${esc(code)}</text>
  <text x="44" y="128" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="${muted}"${fit(verify.length, 40)}>${esc(verify)}</text>
</svg>`;
}

export function svgToBlob(svg: string): Blob {
  return new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
}

/** Convertit le SVG en PNG (2× pour l'impression). */
export async function svgToPngBlob(svg: string, scale = 2): Promise<Blob> {
  const url = URL.createObjectURL(svgToBlob(svg));
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Image du badge illisible'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponible');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Export PNG impossible'))), 'image/png'),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
