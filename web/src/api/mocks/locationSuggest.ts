/**
 * Lieux proposés pour un décor : version SIMULÉE de POST /planner/locations/suggest.
 * Comme le vrai backend, l'« IA » ne propose que des TYPES de lieux ; les `candidates` simulent la
 * recherche géographique avec des lieux publics connus de Tunis (coordonnées approximatives,
 * liens vers la carte OpenStreetMap par coordonnées). Données de démonstration.
 */
import type {
  LocationNeeds,
  LocationProposition,
  LocationSuggestInput,
  LocationSuggestResult,
  PlaceCandidate,
} from '../types';

const place = (name: string, address: string, lat: number, lon: number): PlaceCandidate => ({
  name,
  address,
  lat,
  lon,
  osm_url: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=18/${lat}/${lon}`,
});

const PLACES = {
  mrabet: place('Café M’Rabet', 'Souk Ettrouk, Médina de Tunis, Tunis', 36.7985, 10.1712),
  chaouachine: place('Café Chaouachine', 'Souk Ech-Chaouachia, Médina de Tunis, Tunis', 36.799, 10.17),
  cafeParis: place('Café de Paris', 'Avenue Habib-Bourguiba, Tunis', 36.8003, 10.1829),
  bourguiba: place('Avenue Habib-Bourguiba', 'Avenue Habib-Bourguiba, Tunis', 36.8, 10.186),
  zitouna: place('Rue Jamaa Ezzitouna', 'Rue Jamaa Ezzitouna, Médina de Tunis, Tunis', 36.798, 10.1715),
  marche: place('Marché central de Tunis', 'Rue Charles-de-Gaulle, Tunis', 36.799, 10.182),
  marsa: place('Plage de La Marsa', 'La Marsa, Tunis', 36.8826, 10.3302),
  gammarth: place('Plage de Gammarth', 'Gammarth, La Marsa, Tunis', 36.918, 10.287),
  delices: place('Café des Délices', 'Sidi Bou Saïd, Tunis', 36.8686, 10.347),
  port: place('Port de Sidi Bou Saïd', 'Port de plaisance, Sidi Bou Saïd, Tunis', 36.874, 10.353),
  attarine: place('Souk El Attarine', 'Souk El Attarine, Médina de Tunis, Tunis', 36.7978, 10.1717),
};

type Set3 = { besoins: LocationNeeds; propositions: LocationProposition[][] };

const prop = (
  p: Omit<LocationProposition, 'a_verifier_sur_place' | 'candidates'> &
    Partial<Pick<LocationProposition, 'a_verifier_sur_place' | 'candidates'>>,
): LocationProposition => ({ a_verifier_sur_place: [], candidates: [], ...p });

const CAFE: Set3 = {
  besoins: {
    a_voir: ['un comptoir', 'des tables et des chaises de café', 'une devanture ou un rideau de fer'],
    actions: ['ouvrir le café', 'parler derrière le comptoir'],
    ambiance: 'Un café de quartier, simple et familier, un peu hors du temps.',
    pratique: ['intérieur', 'peu de bruit de rue pour le son', 'tourner avant l’arrivée des clients'],
  },
  propositions: [
    [
      prop({
        type_de_lieu: 'Café traditionnel de la Médina',
        pourquoi:
          'C’est le café du script : vieux comptoir, carrelage, habitués. Le décor raconte déjà l’histoire.',
        requete_recherche: 'café médina',
        zone: 'Médina de Tunis',
        facilite: 'moyenne',
        autorisation_probable: 'a_demander',
        a_verifier_sur_place: ['le bruit des souks', 'la place pour la caméra entre les tables'],
        candidates: [PLACES.mrabet, PLACES.chaouachine],
      }),
      prop({
        type_de_lieu: 'Café de centre-ville avec terrasse',
        pourquoi: 'Plus facile d’accès et plus lumineux, tout en gardant un vrai comptoir.',
        requete_recherche: 'café avenue Habib Bourguiba',
        zone: 'Centre-ville, avenue Habib-Bourguiba',
        facilite: 'moyenne',
        autorisation_probable: 'a_demander',
        a_verifier_sur_place: ['la circulation devant les vitres'],
        candidates: [PLACES.cafeParis],
      }),
      prop({
        type_de_lieu: 'Petit café de quartier fermé le matin',
        pourquoi: 'Le plus simple à obtenir : on tourne avant l’ouverture, sans clients ni bruit.',
        requete_recherche: 'café de quartier fermé le matin',
        zone: 'Quartier résidentiel',
        facilite: 'facile',
        autorisation_probable: 'non_necessaire',
        a_verifier_sur_place: ['l’accord du gérant', 'les prises électriques'],
      }),
    ],
    [
      prop({
        type_de_lieu: 'Salon de thé à Sidi Bou Saïd',
        pourquoi: 'Une autre ambiance de café, plus lumineuse, si la Médina est trop bruyante.',
        requete_recherche: 'café Sidi Bou Saïd',
        zone: 'Sidi Bou Saïd',
        facilite: 'moyenne',
        autorisation_probable: 'a_demander',
        a_verifier_sur_place: ['le monde en fin de semaine'],
        candidates: [PLACES.delices],
      }),
      prop({
        type_de_lieu: 'Arrière-salle de restaurant',
        pourquoi: 'Un comptoir et des tables, souvent libres le matin.',
        requete_recherche: 'restaurant traditionnel Tunis',
        zone: 'Centre-ville',
        facilite: 'facile',
        autorisation_probable: 'non_necessaire',
      }),
      prop({
        type_de_lieu: 'Café reconstitué dans un local vide',
        pourquoi: 'Tu contrôles tout : lumière, son, horaires. Il faut quelques meubles.',
        requete_recherche: 'local commercial à louer Tunis',
        zone: 'Partout',
        facilite: 'difficile',
        autorisation_probable: 'non_necessaire',
        a_verifier_sur_place: ['le loyer à la journée'],
      }),
    ],
  ],
};

const RUE: Set3 = {
  besoins: {
    a_voir: ['une rue animée', 'des passants', 'des façades de ville'],
    actions: ['marcher ou courir dans la rue', 'se croiser dans la foule'],
    ambiance: 'La ville vivante, pressée, qui entoure les personnages.',
    pratique: [
      'extérieur',
      'des figurants naturels',
      'le son de la ville',
      'autorisation pour la voie publique',
    ],
  },
  propositions: [
    [
      prop({
        type_de_lieu: 'Grande avenue du centre-ville',
        pourquoi: 'La foule et les façades sont déjà là : pas besoin de figurants.',
        requete_recherche: 'avenue Habib Bourguiba',
        zone: 'Centre-ville',
        facilite: 'difficile',
        autorisation_probable: 'a_demander',
        a_verifier_sur_place: ['la présence policière', 'les heures de pointe'],
        candidates: [PLACES.bourguiba],
      }),
      prop({
        type_de_lieu: 'Ruelle commerçante de la Médina',
        pourquoi: 'Animée mais plus étroite : plus facile à cadrer et à bloquer quelques minutes.',
        requete_recherche: 'rue Jamaa Ezzitouna',
        zone: 'Médina de Tunis',
        facilite: 'moyenne',
        autorisation_probable: 'a_demander',
        a_verifier_sur_place: ['les jours de fermeture des souks'],
        candidates: [PLACES.zitouna],
      }),
      prop({
        type_de_lieu: 'Abords d’un marché',
        pourquoi: 'Du monde à toute heure du matin, et un tournage discret passe inaperçu.',
        requete_recherche: 'marché central Tunis',
        zone: 'Centre-ville',
        facilite: 'facile',
        autorisation_probable: 'non_necessaire',
        candidates: [PLACES.marche],
      }),
    ],
    [],
  ],
};

const PLAGE: Set3 = {
  besoins: {
    a_voir: ['la mer', 'une plage dégagée'],
    actions: ['marcher seule au bord de l’eau'],
    ambiance: 'Calme, un peu de solitude face à la mer.',
    pratique: ['extérieur', 'peu de baigneurs', 'le vent pour le son'],
  },
  propositions: [
    [
      prop({
        type_de_lieu: 'Plage urbaine hors saison',
        pourquoi: 'En novembre, la plage est presque vide : la solitude du script est là.',
        requete_recherche: 'plage La Marsa',
        zone: 'Banlieue nord',
        facilite: 'facile',
        autorisation_probable: 'non_necessaire',
        a_verifier_sur_place: ['le vent', 'l’accès en voiture pour le matériel'],
        candidates: [PLACES.marsa],
      }),
      prop({
        type_de_lieu: 'Plage plus sauvage au nord',
        pourquoi: 'Moins de bâtiments dans le cadre, horizon plus ouvert.',
        requete_recherche: 'plage Gammarth',
        zone: 'Gammarth',
        facilite: 'moyenne',
        autorisation_probable: 'non_necessaire',
        candidates: [PLACES.gammarth],
      }),
      prop({
        type_de_lieu: 'Corniche au bord de la mer',
        pourquoi: 'La mer est là, avec un accès facile et de la lumière tard le soir.',
        requete_recherche: 'corniche bord de mer',
        zone: 'Banlieue nord',
        facilite: 'facile',
        autorisation_probable: 'non_necessaire',
      }),
    ],
    [],
  ],
};

const GENERIQUE: Set3 = {
  besoins: {
    a_voir: [],
    actions: [],
    ambiance: 'À préciser : les scènes de ce décor donnent peu de détails.',
    pratique: [],
  },
  propositions: [
    [
      prop({
        type_de_lieu: 'Lieu chez un proche',
        pourquoi: 'Le plus simple pour un premier film : gratuit et disponible.',
        requete_recherche: 'appartement',
        zone: 'Chez un proche',
        facilite: 'facile',
        autorisation_probable: 'non_necessaire',
      }),
      prop({
        type_de_lieu: 'Maison de la culture',
        pourquoi: 'Souvent prête à accueillir des tournages de jeunes cinéastes.',
        requete_recherche: 'maison de la culture',
        zone: 'Ta ville',
        facilite: 'moyenne',
        autorisation_probable: 'a_demander',
      }),
      prop({
        type_de_lieu: 'Local associatif',
        pourquoi: 'Des pièces modulables, souvent libres en semaine.',
        requete_recherche: 'association',
        zone: 'Ta ville',
        facilite: 'moyenne',
        autorisation_probable: 'non_necessaire',
      }),
    ],
    [],
  ],
};

/** Lieux abrités, quand la météo menace les scènes en extérieur. */
const ABRI: LocationProposition[] = [
  prop({
    type_de_lieu: 'Souk couvert de la Médina',
    pourquoi: 'L’animation d’une rue, mais sous un toit : la pluie ne gêne pas le tournage.',
    requete_recherche: 'souk couvert médina',
    zone: 'Médina de Tunis',
    facilite: 'moyenne',
    autorisation_probable: 'a_demander',
    a_verifier_sur_place: ['la lumière, plus sombre que dehors'],
    candidates: [PLACES.attarine],
  }),
  prop({
    type_de_lieu: 'Marché couvert',
    pourquoi: 'Du monde, des étals, et un abri en cas d’averse.',
    requete_recherche: 'marché central Tunis',
    zone: 'Centre-ville',
    facilite: 'facile',
    autorisation_probable: 'non_necessaire',
    candidates: [PLACES.marche],
  }),
  prop({
    type_de_lieu: 'Café avec grande baie vitrée',
    pourquoi: 'On voit la rue à travers la vitre, mais l’équipe reste à l’abri.',
    requete_recherche: 'café terrasse couverte Tunis',
    zone: 'Centre-ville',
    facilite: 'facile',
    autorisation_probable: 'a_demander',
  }),
];

/** Lieux abrités qui gardent la mer à l'image (décors de bord de mer). */
const ABRI_MER: LocationProposition[] = [
  prop({
    type_de_lieu: 'Café en bord de mer avec baie vitrée',
    pourquoi: 'La mer reste à l’image, mais l’équipe et le matériel sont à l’abri.',
    requete_recherche: 'café Sidi Bou Saïd',
    zone: 'Sidi Bou Saïd',
    facilite: 'moyenne',
    autorisation_probable: 'a_demander',
    a_verifier_sur_place: ['les reflets sur la vitre'],
    candidates: [PLACES.delices],
  }),
  prop({
    type_de_lieu: 'Quai de port abrité',
    pourquoi: 'Bord de mer, avec des auvents et des bâtiments pour s’abriter entre deux averses.',
    requete_recherche: 'port Sidi Bou Saïd',
    zone: 'Sidi Bou Saïd',
    facilite: 'moyenne',
    autorisation_probable: 'a_demander',
    candidates: [PLACES.port],
  }),
];

function pick(input: LocationSuggestInput): Set3 {
  const text = [input.decor.name, ...input.scenes.map((s) => `${s.title} ${s.summary}`)]
    .join(' ')
    .toLowerCase();
  if (/caf[ée]|comptoir|salon de th/.test(text)) return CAFE;
  if (/plage|\bmer\b|côti/.test(text)) return PLAGE;
  if (/\brue|ruelle|avenue|march[ée]/.test(text)) return RUE;
  return GENERIQUE;
}

export function mockSuggestLocations(input: LocationSuggestInput): LocationSuggestResult {
  const set = pick(input);
  const seen = new Set(input.exclude.map((x) => x.toLowerCase()));
  // Météo menaçante : des lieux abrités d'abord
  const sheltered = (input.constraints ?? []).some((c) => /abrit/i.test(c))
    ? (set === PLAGE ? ABRI_MER : ABRI).filter((p) => !seen.has(p.type_de_lieu.toLowerCase()))
    : [];
  // « Proposer d'autres lieux » : on passe au lot suivant, sans reproposer un type déjà vu
  const batch = sheltered.length
    ? sheltered
    : (set.propositions.find((b) => b.length && b.every((p) => !seen.has(p.type_de_lieu.toLowerCase()))) ??
      set.propositions[0].filter((p) => !seen.has(p.type_de_lieu.toLowerCase())));
  const others = input.other_decors.filter((d) => d.toLowerCase() !== input.decor.name.toLowerCase());
  const mutualisation =
    set === CAFE
      ? (others.find((d) => /rue|ruelle|médina/i.test(d)) ?? null)
      : set === RUE
        ? (others.find((d) => /caf[ée]/i.test(d)) ?? null)
        : null;
  return {
    status: 'Brouillon IA : à valider',
    decor: input.decor.name,
    besoins: set.besoins,
    propositions: batch.slice(0, 3),
    mutualisation,
    model: 'simulation',
  };
}
