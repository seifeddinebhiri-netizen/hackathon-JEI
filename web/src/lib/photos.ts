/**
 * Registre des photos (public/photos/). Toutes viennent d'Unsplash, sous licence Unsplash (gratuite).
 * Chaque photo existe en JPEG et WebP, en 2000 px et 1000 px de large.
 * Toute nouvelle photo doit être ajoutée ici ET dans public/photos/CREDITS.md.
 */
export type Photo = {
  /** Nom de base du fichier dans public/photos/ (sans extension) */
  file: string;
  alt: string;
  author: string;
  /** Profil Unsplash du photographe */
  authorUrl: string;
  /** Page Unsplash de la photo */
  photoUrl: string;
  /** Point d'intérêt pour le recadrage (object-position) */
  position?: string;
  /** Où la photo est utilisée */
  usage: string;
};

const UTM = '?utm_source=encadre&utm_medium=referral';

export const PHOTOS = {
  hero: {
    file: 'hero',
    alt: 'Plateau de tournage en studio : projecteurs, caméras et équipe au travail',
    author: 'Brands&People',
    authorUrl: `https://unsplash.com/@brandsandpeople${UTM}`,
    photoUrl: 'https://unsplash.com/photos/film-crew-on-soundstage-workspace-br2HgQuvq6I',
    position: '50% 55%',
    usage: 'Accueil, hero',
  },
  ruelle: {
    file: 'ruelle',
    alt: 'Ruelle pavée bordée de murs blancs et de portes bleues, près de Carthage',
    author: 'Alex Vasey',
    authorUrl: `https://unsplash.com/@alexrvasey${UTM}`,
    photoUrl:
      'https://unsplash.com/photos/a-narrow-cobblestone-street-lined-with-white-buildings-cnuXEBrW-6U',
    position: '50% 60%',
    usage: 'Accueil (bande photo), page film de démo',
  },
  tournageTelephone: {
    file: 'tournage-telephone',
    alt: 'Une main tient un téléphone monté sur un stabilisateur, prêt à filmer',
    author: 'I’M ZION',
    authorUrl: `https://unsplash.com/@ziontech${UTM}`,
    photoUrl: 'https://unsplash.com/photos/a-person-holding-a-cell-phone-up-to-a-camera-_wjIdPPekTA',
    position: '45% 35%',
    usage: 'Accueil (bande photo)',
  },
  projection: {
    file: 'projection',
    alt: 'Faisceaux d’un projecteur au-dessus des fauteuils rouges d’une salle de cinéma sombre',
    author: 'Rafi Mohammed',
    authorUrl: `https://unsplash.com/@iamrafimohammed${UTM}`,
    photoUrl:
      'https://unsplash.com/photos/projector-light-beams-illuminate-an-empty-cinema-auditorium-L70rE9UChmI',
    position: '50% 40%',
    usage: 'Accueil (bande photo)',
  },
  coach: {
    file: 'coach',
    alt: 'Un homme filme avec son téléphone pendant un événement en plein air, la nuit',
    author: 'Amari Shutters',
    authorUrl: `https://unsplash.com/@asnanya${UTM}`,
    photoUrl: 'https://unsplash.com/photos/man-filming-with-phone-at-outdoor-event-at-night-l3Q3u5I9xes',
    position: '50% 70%',
    usage: 'Coach (ordinateur)',
  },
  porte: {
    file: 'porte',
    alt: 'Porte rouge et noire en arc dans un mur blanc, à Sidi Bou Saïd',
    author: 'Brahim Guedich',
    authorUrl: `https://unsplash.com/@brahimguedich${UTM}`,
    photoUrl: 'https://unsplash.com/photos/a-red-and-black-door-on-a-white-building-8Z-i0YrTZqo',
    position: '50% 45%',
    usage: 'Planner (lieux), page film de démo',
  },
  drapeaux: {
    file: 'drapeaux',
    alt: 'Drapeaux tunisiens tendus au-dessus d’une avenue de Tunis',
    author: 'Carnet de Voyage d’Alex',
    authorUrl: `https://unsplash.com/@alexisribeyrecarnetdevoyage${UTM}`,
    photoUrl:
      'https://unsplash.com/photos/red-flags-strung-across-a-city-street-with-modern-buildings-XNFi52ZR0jg',
    position: '50% 30%',
    usage: 'Planner (lieux)',
  },
  cote: {
    file: 'cote',
    alt: 'Terrasses blanches et bleues face à la mer et au port, à Carthage',
    author: 'Tina Boujemil',
    authorUrl: `https://unsplash.com/@sidibeau${UTM}`,
    photoUrl:
      'https://unsplash.com/photos/people-on-beach-near-white-concrete-building-during-daytime-TX-9Ze-9nk8',
    position: '60% 50%',
    usage: 'Page film de démo',
  },
} satisfies Record<string, Photo>;

export type PhotoKey = keyof typeof PHOTOS;

export function photoSources(p: Photo) {
  const b = `/photos/${p.file}`;
  return {
    jpg: `${b}.jpg`,
    webpSet: `${b}-1000.webp 1000w, ${b}.webp 2000w`,
    jpgSet: `${b}-1000.jpg 1000w, ${b}.jpg 2000w`,
  };
}

/** Retrouve une photo du registre à partir d'une URL (ex. les `stills` d'un film). */
export function photoFromUrl(url: string): Photo | undefined {
  return Object.values(PHOTOS).find(
    (p) => url.startsWith(`/photos/${p.file}.`) || url === `/photos/${p.file}`,
  );
}
