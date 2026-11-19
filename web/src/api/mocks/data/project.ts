/**
 * Projet de démonstration : « Dar Hmeti », un court métrage FICTIF tourné à Tunis
 * (15 min, derja, fiction, 1 usage d'IA déclaré dans le Passeport : le montage).
 * L'identifiant reste `demo-maree-basse` (ancien titre) pour ne pas casser les sessions enregistrées.
 * Les dates sont relatives à aujourd'hui pour que la démo reste crédible
 * (une partie de la période dépasse l'horizon météo de 14 jours, volontairement).
 * Noms d'acteurs, adresses précises : [placeholders].
 */
import type { KitPieceState, Project } from '@/api/types';
import { demoDate } from '../weather';

export const DEMO_PROJECT_ID = 'demo-maree-basse';

export function buildDemoProject(): Project {
  return {
    id: DEMO_PROJECT_ID,
    title: 'Dar Hmeti',
    format: 'court',
    city: 'Tunis',
    shooting_window: { from: demoDate(5), to: demoDate(24) },
    max_hours_per_day: 8,
    locations: [
      {
        id: 'loc-medina',
        name: 'Médina : ruelle et café',
        address: 'Médina de Tunis, [adresse exacte à compléter]',
        lat: 36.7986,
        lon: 10.1706,
        access_hours: { from: '07:00', to: '23:00' },
        forbidden_days: ['vendredi'],
        permit: 'a_demander',
        notes: 'Café ouvert aux clients le matin : tourner après 10 h si possible. [contact du gérant]',
      },
      {
        id: 'loc-appart',
        name: 'Appartement d’Amira',
        address: 'La Marsa, [adresse à compléter]',
        lat: 36.8782,
        lon: 10.3247,
        forbidden_days: [],
        permit: 'non_necessaire',
        notes: 'Prévenir les voisins. Pas de bruit après 22 h.',
      },
      {
        id: 'loc-plage',
        name: 'Plage et route côtière',
        address: 'Gammarth, [accès plage à préciser]',
        lat: 36.9197,
        lon: 10.2894,
        access_hours: { from: '05:00', to: '22:00' },
        forbidden_days: [],
        permit: 'obtenue',
        notes: 'Parking limité : covoiturage.',
      },
    ],
    scenes: [
      {
        id: 'sc-1',
        number: '1',
        title: 'Amira ouvre le café',
        setting: 'INT',
        moment: 'jour',
        location_id: 'loc-medina',
        characters: ['Amira', 'Mounir'],
        estimated_hours: 2,
        summary: 'Amira lève le rideau du café de son oncle, qui lui annonce la vente.',
        source: 'import_ia',
        validated: true,
      },
      {
        id: 'sc-2',
        number: '2',
        title: 'Course dans les ruelles',
        setting: 'EXT',
        moment: 'jour',
        location_id: 'loc-medina',
        characters: ['Amira', 'Slim'],
        estimated_hours: 1.5,
        summary: 'Amira poursuit Slim dans la médina pour récupérer les clés.',
        source: 'import_ia',
        validated: true,
      },
      {
        id: 'sc-3',
        number: '3',
        title: 'Dispute avec Slim',
        setting: 'INT',
        moment: 'nuit',
        location_id: 'loc-appart',
        characters: ['Amira', 'Slim'],
        estimated_hours: 2.5,
        summary: 'Le frère et la sœur s’affrontent sur l’avenir du café.',
        source: 'import_ia',
        validated: true,
      },
      {
        id: 'sc-4',
        number: '4',
        title: 'Amira face à la mer',
        setting: 'EXT',
        moment: 'heure_doree',
        location_id: 'loc-plage',
        characters: ['Amira'],
        estimated_hours: 1,
        summary: 'Seule sur la plage, Amira relit la lettre de son père.',
        source: 'import_ia',
        validated: true,
      },
      {
        id: 'sc-5',
        number: '5',
        title: 'Départ sur la route côtière',
        setting: 'EXT',
        moment: 'aube',
        location_id: 'loc-plage',
        characters: ['Amira', 'Nour'],
        estimated_hours: 1.5,
        summary: 'Nour conduit Amira vers la gare au lever du jour.',
        source: 'import_ia',
        validated: true,
      },
      {
        id: 'sc-6',
        number: '6',
        title: 'Le colis',
        setting: 'INT',
        moment: 'jour',
        location_id: 'loc-appart',
        characters: ['Amira', 'Nour'],
        estimated_hours: 1.5,
        summary: 'Nour apporte un colis oublié au café des années plus tôt.',
        source: 'manuel',
        validated: true,
      },
      {
        id: 'sc-7',
        number: '7',
        title: 'Mounir ferme le café',
        setting: 'EXT',
        moment: 'nuit',
        location_id: 'loc-medina',
        characters: ['Mounir', 'Amira'],
        estimated_hours: 2,
        summary: 'Dernière fermeture du rideau, sous les lampes de la ruelle.',
        source: 'import_ia',
        validated: true,
      },
    ],
    people: [
      { id: 'p-1', kind: 'acteur', name: '[Actrice 1]', role: 'Actrice', character: 'Amira' },
      { id: 'p-2', kind: 'acteur', name: '[Acteur 2]', role: 'Acteur', character: 'Slim' },
      { id: 'p-3', kind: 'acteur', name: '[Acteur 3]', role: 'Acteur', character: 'Mounir' },
      { id: 'p-4', kind: 'acteur', name: '[Actrice 4]', role: 'Actrice', character: 'Nour' },
      { id: 'p-5', kind: 'equipe', name: 'Yassine', role: 'Réalisation' },
      { id: 'p-6', kind: 'equipe', name: '[Nom]', role: 'Image' },
      { id: 'p-7', kind: 'equipe', name: '[Nom]', role: 'Son' },
      { id: 'p-8', kind: 'equipe', name: '[Nom]', role: 'Régie' },
    ],
    festival_shortlist: [
      { festival_id: 'bsff-next-generation', status: 'a_preparer' },
      { festival_id: 'vienna-shorts', status: 'a_preparer' },
      { festival_id: 'clermont-international', status: 'prochain_appel' },
    ],
    film_profile: { duration_min: 15, language: 'Derja (arabe tunisien)', genre: 'Fiction' },
    synopsis: {
      phrase: 'Slim veut vendre le café de son père à Tunis, mais sa sœur Amira refuse de le laisser partir.',
      court:
        'Dans la médina de Tunis, Slim a vendu en secret le café que leur père a tenu pendant quarante ans. Quand sa sœur Amira l’apprend, une dispute éclate entre les murs blancs du café. Pendant une nuit, ils vident les étagères, retrouvent les photos, les dettes et les promesses. Au matin, Amira comprend pourquoi Slim est parti, et Slim comprend ce qu’il a vendu.',
      long: '',
    },
    film_page: { stills: ['/photos/ruelle.jpg', '/photos/porte.jpg', '/photos/cote.jpg'] },
  };
}

/**
 * Pièces cochées à la main dans la démo (clés de pieceKeyOf) : « Film et inscription » prêt pour
 * Vienna Shorts. Les photos, synopsis, sous-titres et déclaration IA sont calculés.
 */
export const DEMO_PIECES: Record<string, KitPieceState> = { 'format:vienna-shorts': 'pret' };
