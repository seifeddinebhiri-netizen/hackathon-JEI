import { brand } from '@/app/brand';

/**
 * Badge « Passeport IA » à mettre au générique ou sur l'affiche.
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
  const bg = light ? '#FFFFFF' : '#121110';
  const fg = light ? '#121110' : '#F2F2EF';
  const accent = '#FFC82E';
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="160" viewBox="0 0 480 160">
  <rect width="480" height="160" fill="${bg}"/>
  <rect x="6" y="6" width="468" height="148" fill="none" stroke="${fg}" stroke-width="4"/>
  <rect x="24" y="30" width="100" height="100" fill="${brand.colors.mark}"/>
  <text x="74" y="82" text-anchor="middle" dominant-baseline="central" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="38" fill="#FFFFFF">IA</text>
  <text x="146" y="58" font-family="'Courier New', monospace" font-weight="700" font-size="16" letter-spacing="2" fill="${light ? fg : accent}">PASSEPORT IA</text>
  <text x="146" y="96" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="34" fill="${fg}">${esc(code)}</text>
  <text x="146" y="126" font-family="Arial, Helvetica, sans-serif" font-size="15" fill="${fg}"${verifyHost.length > 34 ? ' textLength="310" lengthAdjust="spacingAndGlyphs"' : ''}>Vérifier : ${esc(verifyHost)}</text>
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
