/**
 * Identité de l'application : SOURCE UNIQUE du nom, du slogan et des logos.
 * Les fichiers du logo viennent du pack déposé dans public/brand/ (svg/ et png/) : ne pas les modifier à la main.
 *
 * Ce fichier ne doit rien importer : il est lu par vite.config.ts.
 */
export const brand = {
  /** Nom affiché partout — toujours en minuscules, y compris en début de phrase */
  name: 'encadré',
  /** Nom court (écran d'accueil du téléphone) */
  shortName: 'encadré',
  /** Identifiant technique ASCII (domaines de démo, noms de fichiers exportés) */
  slug: 'encadre',
  /** Slogan, en une phrase */
  slogan: 'Tu cadres, on t’encadre.',
  /**
   * Slogan du hero, une ligne par entrée. Le texte entre *astérisques* est mis en couleur.
   */
  sloganLines: ['Tu cadres,', 'on t’*encadre.*'],
  /** Phrase courte sous le logo (pied de page) */
  tagline: 'Du tournage au festival, sans faire le travail créatif à ta place.',
  /** Public visé (surtitre du hero) */
  audience: 'Pour les jeunes réalisateurs tunisiens',
  /** Description longue (meta description, manifeste PWA) */
  description:
    "Accompagne les jeunes réalisateurs tunisiens, de l'organisation du tournage jusqu'au festival, et rend visible ce qui est humain et ce qui est IA.",
  /** Préfixe des identifiants de badge du Passeport IA (ex. EN-7K3Q-2M) */
  badgePrefix: 'EN',
  /** Fichiers du pack de logos (chemins publics) */
  logos: {
    /** Logo sans fond, pour les fonds sombres (nav, pied de page) */
    onDark: '/brand/svg/encadre-logo-transparent-pour-fond-sombre.svg',
    /** Logo sans fond, pour les fonds clairs (documents, pages claires) */
    onLight: '/brand/svg/encadre-logo-transparent-pour-fond-clair.svg',
    /** Logo avec slogan, sur fond sombre */
    withSloganDark: '/brand/svg/encadre-logo-slogan-sombre.svg',
    /** Icône carrée « é. » */
    icon: '/brand/svg/encadre-icone.svg',
    favicon: '/brand/svg/encadre-favicon.svg',
    faviconPng: '/brand/png/encadre-favicon-64.png',
    icon192: '/brand/png/encadre-icone-192.png',
    icon512: '/brand/png/encadre-icone.png',
    /** Dérivés du pack (marges de sécurité) : voir public/icons/README.md */
    maskable512: '/icons/encadre-icone-maskable-512.png',
    appleTouch: '/icons/apple-touch-icon.png',
  },
  /** Rapport largeur / hauteur du logo sans fond (viewBox 514.24 × 172) */
  logoRatio: 514.24 / 172,
  colors: { background: '#121110', mark: '#E4202E', accent: '#FFC82E', text: '#F2F2EF' },
} as const;

/** Slogan en une ligne, sans les marques de mise en couleur. */
export const brandSlogan = brand.slogan;

/** Découpe une ligne du slogan en segments normaux / mis en couleur. */
export function sloganSegments(line: string): { text: string; accent: boolean }[] {
  return line
    .split(/(\*[^*]+\*)/)
    .filter(Boolean)
    .map((t) => (t.startsWith('*') ? { text: t.slice(1, -1), accent: true } : { text: t, accent: false }));
}
