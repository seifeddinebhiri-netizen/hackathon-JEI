/**
 * Identité de l'application : SOURCE UNIQUE du nom, du slogan et du logo.
 * Changer le nom ici suffit : interface, <title>, description, manifeste PWA et icônes
 * (icônes régénérées par `npm run brand:icons`, lancé aussi avant chaque build).
 *
 * Ce fichier ne doit rien importer : il est lu par vite.config.ts et par scripts/brand-icons.ts.
 */
export const brand = {
  /** Nom affiché partout */
  name: 'Premier Plan',
  /** Nom court (écran d'accueil du téléphone) */
  shortName: 'Premier Plan',
  /** Identifiant technique en minuscules (barres de titre des captures, domaines de démo) */
  slug: 'premierplan',
  /** Lettre du logo carré */
  monogram: 'P',
  /**
   * Slogan du hero, une ligne par entrée. Le texte entre *astérisques* est mis en couleur.
   */
  sloganLines: ['Tourne.', 'Déclare.', 'Fais-toi *voir.*'],
  /** Phrase courte sous le logo (pied de page) */
  tagline: 'Du tournage au festival, sans faire le travail créatif à ta place.',
  /** Public visé (surtitre du hero) */
  audience: 'Pour les jeunes réalisateurs tunisiens',
  /** Description longue (meta description, manifeste PWA) */
  description:
    "Accompagne les jeunes réalisateurs tunisiens, de l'organisation du tournage jusqu'au festival, et rend visible ce qui est humain et ce qui est IA.",
  /** Préfixe des identifiants de badge du Passeport IA (ex. PP-7K3Q-2M) */
  badgePrefix: 'PP',
  colors: { background: '#121110', mark: '#E4202E', markText: '#F2F2EF' },
} as const;

/** Slogan en une ligne, sans les marques de mise en couleur. */
export const brandSlogan = brand.sloganLines.join(' ').replace(/\*/g, '');

/** Découpe une ligne du slogan en segments normaux / mis en couleur. */
export function sloganSegments(line: string): { text: string; accent: boolean }[] {
  return line
    .split(/(\*[^*]+\*)/)
    .filter(Boolean)
    .map((t) => (t.startsWith('*') ? { text: t.slice(1, -1), accent: true } : { text: t, accent: false }));
}

/** Logo carré en SVG (favicon, icônes PWA). */
export function brandMarkSvg({ maskable = false }: { maskable?: boolean } = {}): string {
  const { background, mark, markText } = brand.colors;
  const inset = maskable ? 0 : 10;
  const size = 64 - inset * 2;
  const fontSize = maskable ? 30 : 32;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${maskable ? mark : background}"/><rect x="${inset}" y="${inset}" width="${size}" height="${size}" fill="${mark}"/><text x="32" y="33" text-anchor="middle" dominant-baseline="central" font-family="'Space Grotesk', Arial, sans-serif" font-weight="700" font-size="${fontSize}" fill="${markText}">${brand.monogram}</text></svg>`;
}
