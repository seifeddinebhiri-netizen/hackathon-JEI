import type { ComponentType } from 'react';
import type { MascotSpec } from '@/components/GuideMascot';
import { Previously } from '@/scenes/Previously';
import { TitleCard } from '@/scenes/TitleCard';
import { Testimonials } from '@/scenes/Testimonials';
import { WhyNow } from '@/scenes/WhyNow';
import { ProjectSet } from '@/scenes/ProjectSet';
import { Storyboard } from '@/scenes/Storyboard';
import { Features } from '@/scenes/Features';
import { Demo } from '@/scenes/Demo';
import { Ethics } from '@/scenes/Ethics';
import { Closing } from '@/scenes/Closing';

export type TransitionType = 'clap' | 'film' | 'script' | 'band' | 'iris' | 'cut';

export interface SceneProps {
  beat: number;
}

export interface SceneDef {
  id: string;
  /** Numéro affiché (« 00 » à « 06 ») */
  num: string;
  title: string;
  /** Lieu de tournage de la séquence */
  place: string;
  /** Question à laquelle la séquence répond */
  question: string;
  Component: ComponentType<SceneProps>;
  beats: number;
  /** Transition utilisée pour ENTRER dans cette scène (en avançant) */
  enter: TransitionType;
  /** Durée orale indicative, en secondes */
  seconds: number;
  /** Mode automatique : durée de chaque étape (s) */
  beatSeconds?: number[];
  /** Position de Baba Jamil à chaque étape (null : hors champ) */
  mascot: (MascotSpec | null)[];
  /** Notes orales, une entrée par étape */
  notes: string[];
}

const off = (x: number, y = 1010, size = 260): MascotSpec => ({ x, y, size, pose: 'salut', hidden: true });

export const DECK: SceneDef[] = [
  {
    id: 'precedemment',
    num: '00',
    title: 'Précédemment dans Encadré',
    place: 'Salle obscure',
    question: 'D’où venons-nous ?',
    Component: Previously,
    beats: 3,
    enter: 'cut',
    seconds: 12,
    beatSeconds: [3, 4, 5],
    mascot: [off(-200), off(-200), { x: 230, y: 1040, size: 280, pose: 'parle', prop: 'clap' }],
    notes: [
      '(Laisser défiler la pellicule 2 à 3 secondes, sans parler.)',
      'Il y a quelques jours, nous vous avons présenté un constat : les jeunes réalisateurs tunisiens avancent seuls. Trois artistes nous l’ont dit devant El Teatro.',
      'Aujourd’hui, cette vision prend forme. Baba Jamil lève le clap : on passe derrière la caméra.',
    ],
  },
  {
    id: 'titre',
    num: '00',
    title: 'Prise 02 — Derrière la caméra',
    place: 'Carton de titre',
    question: 'Que venons-nous montrer ?',
    Component: TitleCard,
    beats: 2,
    enter: 'clap',
    seconds: 12,
    beatSeconds: [4, 8],
    mascot: [
      { x: 1600, y: 960, size: 380, pose: 'salut', shadow: true },
      { x: 1600, y: 960, size: 380, pose: 'parle', shadow: true },
    ],
    notes: [
      'Encadré, prise 02 : derrière la caméra. Une idée, un premier prototype, et maintenant les coulisses.',
      'La première fois, nous vous avons montré pourquoi Encadré devait exister. Aujourd’hui, comment nous lui avons donné vie. Toujours avec la même règle : l’IA propose, le cinéaste décide.',
    ],
  },
  {
    id: 'temoignages',
    num: '00',
    title: 'Problématique : cinq entretiens',
    place: 'Le mur',
    question: 'Qu’est-ce qui bloque les jeunes cinéastes ?',
    Component: Testimonials,
    beats: 7,
    enter: 'band',
    seconds: 45,
    beatSeconds: [4, 7, 7, 7, 7, 7, 6],
    mascot: [
      { x: 1815, y: 1062, size: 150, pose: 'parle' },
      { x: 1815, y: 1062, size: 150, pose: 'parle' },
      { x: 1815, y: 1062, size: 150, pose: 'parle' },
      { x: 1815, y: 1062, size: 150, pose: 'parle' },
      { x: 1815, y: 1062, size: 150, pose: 'parle' },
      { x: 1815, y: 1062, size: 150, pose: 'parle' },
      { x: 1815, y: 1062, size: 150, pose: 'montre' },
    ],
    notes: [
      'Avant de construire, nous avons écouté. Cinq entretiens : étudiants en cinéma, réalisateurs, metteur en scène.',
      'Eya Hachicha, étudiante en cinéma : le choix des plans, la planification. Premier axe : planifier.',
      'Eya Guirat : le cadrage, et déclarer l’usage de l’IA. Deux axes : tourner et déclarer.',
      'Nour Elomr Ouni : on n’a pas d’encadrants pour mettre en valeur le projet artistique.',
      'Mariem Ben Jeddi : l’État ne s’intéresse pas aux jeunes artistes.',
      'Tarek Ben Abdelfatteh : ceux qui connaissent le chemin ne t’aident pas à avancer. Trois voix pour le même axe : être vu, diffuser.',
      'Quatre étapes, et à chacune, ils avancent seuls.',
    ],
  },
  {
    id: 'pourquoi',
    num: '00',
    title: 'Problématique : pourquoi maintenant',
    place: 'Le mur',
    question: 'Pourquoi maintenant ?',
    Component: WhyNow,
    beats: 4,
    enter: 'film',
    seconds: 30,
    beatSeconds: [5, 8, 9, 8],
    mascot: [
      { x: 1790, y: 1062, size: 170, pose: 'parle' },
      { x: 1790, y: 1062, size: 170, pose: 'montre' },
      { x: 1790, y: 1062, size: 170, pose: 'montre' },
      { x: 1790, y: 1062, size: 170, pose: 'declarer' },
    ],
    notes: [
      'Pourquoi maintenant ? Parce que personne ne leur a appris comment, et que trois choses ont changé.',
      'Tout le monde peut filmer : un téléphone suffit. Mais organiser un tournage et cadrer, ça ne s’apprend nulle part. Planifier, tourner.',
      'Les règles changent : les Oscars 2027 exigent des scénarios écrits par des humains, et l’AI Act européen impose depuis août 2026 de signaler les contenus truqués par IA. Déclarer devient obligatoire.',
      'Et tout le monde veut être vu : 700 films inscrits aux JCC 2025, 42 en compétition officielle. Il faut arriver prêt. Diffuser.',
    ],
  },
  {
    id: 'projet',
    num: '01',
    title: 'Le projet prend forme',
    place: 'Plateau',
    question: 'Qu’avons-nous conçu ?',
    Component: ProjectSet,
    beats: 3,
    enter: 'clap',
    seconds: 20,
    beatSeconds: [6, 7, 7],
    mascot: [
      { x: 230, y: 1040, size: 230, pose: 'salut' },
      { x: 960, y: 1040, size: 230, pose: 'montre' },
      { x: 1680, y: 1040, size: 230, pose: 'parle', prop: 'script', bubble: 'Tout commence par un scénario.', bubbleSide: 'left' },
    ],
    notes: [
      'Ces quatre blocages sont exactement nos quatre étapes : planifier, tourner, déclarer, diffuser. C’est notre réponse.',
      'Chacune est devenue un module de l’application, de la préparation du tournage jusqu’à la diffusion du film.',
      'Et tout commence par une feuille : le scénario.',
    ],
  },
  {
    id: 'storyboard',
    num: '02',
    title: 'Du storyboard à l’interface',
    place: 'Atelier',
    question: 'Comment l’avons-nous dessiné ?',
    Component: Storyboard,
    beats: 3,
    enter: 'script',
    seconds: 22,
    beatSeconds: [6, 8, 8],
    mascot: [
      { x: 1790, y: 1052, size: 170, pose: 'parle' },
      { x: 1790, y: 1052, size: 170, pose: 'montre' },
      { x: 1790, y: 1052, size: 170, pose: 'montre', bubble: 'Allons voir les quatre modules.', bubbleSide: 'left' },
    ],
    notes: [
      'Avant d’écrire du code, nous avons conçu chaque écran. Exemple : la relecture des sous-titres. D’abord la structure de la page.',
      'Puis une maquette sur un canevas de design : brouillon IA à valider, lignes à risque en premier.',
      'Et l’écran réellement développé. Passons aux quatre modules.',
    ],
  },
  {
    id: 'fonctionnalites',
    num: '03',
    title: 'Les quatre modules, façade et envers du décor',
    place: 'Pellicule',
    question: 'Qu’est-ce qui fonctionne, et comment ?',
    Component: Features,
    beats: 9,
    enter: 'film',
    seconds: 150,
    beatSeconds: [6, 20, 16, 18, 16, 18, 16, 22, 18],
    mascot: [
      { x: 120, y: 1062, size: 170, pose: 'salut' },
      { x: 235, y: 1062, size: 170, pose: 'planifier' },
      { x: 235, y: 1062, size: 170, pose: 'montre' },
      { x: 665, y: 1062, size: 170, pose: 'tourner' },
      { x: 665, y: 1062, size: 170, pose: 'montre' },
      { x: 1095, y: 1062, size: 170, pose: 'declarer' },
      { x: 1095, y: 1062, size: 170, pose: 'montre' },
      { x: 1525, y: 1062, size: 170, pose: 'diffuser' },
      { x: 1525, y: 1062, size: 170, pose: 'montre' },
    ],
    notes: [
      'Quatre modules. Pour chacun : ce que voit le cinéaste, puis l’envers du décor. Tout est capturé dans le prototype et extrait de notre dépôt.',
      'Planifier. On importe un scénario, même en PDF ou Word. L’IA le découpe en scènes, propose des améliorations que l’on accepte ou refuse, suggère des lieux réels et vérifie la météo. Le calendrier est en cours. Le créateur garde le dernier mot.',
      'L’envers du décor : le fichier part vers FastAPI, le modèle (Gemini, Anthropic, Groq ou Ollama en local) renvoie un brouillon contraint par un schéma, le cinéaste valide, le projet est enregistré dans Supabase. En parallèle : vrais lieux par OpenStreetMap, météo par Open-Meteo. Le calendrier est calculé dans le navigateur pour l’instant : partiel.',
      'Tourner. Au premier pitch, le Coach était une illustration. Aujourd’hui, un prototype qui ouvre la caméra et mesure visage, horizon, angle et lumière sur le téléphone, sans rien envoyer. Le plan par l’IA reste à valider avec une vraie clé.',
      'L’envers du décor : la scène va à /shot-spec ; Gemini choisit dans un vocabulaire fermé, appuyé sur 71 règles sourcées ; le serveur convertit les mots en chiffres ; le téléphone mesure en direct avec MediaPipe et les capteurs. Les espaces de travail sont dans Supabase. Prochaine brique : le corps entier.',
      'Déclarer. Le Passeport IA : département par département, ce qui est humain et ce qui vient de l’IA. Chaque outil est cherché dans sa documentation publique. Le PDF est signé en C2PA, avec un certificat de test pour l’instant.',
      'L’envers du décor : le Passeport est dans Supabase, le badge est généré par la base. Un outil inconnu déclenche une recherche : pages officielles en https, Gemini extrait des faits avec citation, le catalogue garde le statut. Le PDF est fabriqué par ReportLab et signé avec c2pa-python ; les festivals le vérifient sans que rien ne soit stocké.',
      'Diffuser. Vingt festivals sourcés, classés par compatibilité, sans prédire la sélection. Les sous-titres : transcription du derja, traduction, relecture ligne par ligne, export verrouillé tant que tout n’est pas validé.',
      'L’envers du décor : les festivals viennent d’un fichier vérifié à la main ; l’audio va chez ElevenLabs puis est supprimé ; Gemini, ou Ollama en local, traduit avec un glossaire derja ; le cinéaste valide chaque ligne ; dossiers et brouillons sont dans Supabase.',
    ],
  },
  {
    id: 'demo',
    num: '04',
    title: 'Place à la démonstration',
    place: 'Salle de projection',
    question: 'Comment l’utilisateur s’en sert-il ?',
    Component: Demo,
    beats: 1,
    enter: 'band',
    seconds: 30,
    beatSeconds: [30],
    mascot: [{ x: 150, y: 1075, size: 200, pose: 'parle', shadow: true }],
    notes: [
      'Démo courte (30 s) : importer le scénario → découpage → accepter une suggestion → calendrier. A : en direct (lancer « npm run dev » dans web/ avant). B : vidéo de secours. C : captures, toujours disponible. Échap pour revenir.',
    ],
  },
  {
    id: 'ethique',
    num: '05',
    title: 'L’éthique au cœur du projet',
    place: 'Devant l’objectif',
    question: 'Comment restons-nous responsables ?',
    Component: Ethics,
    beats: 5,
    enter: 'film',
    seconds: 24,
    beatSeconds: [3, 5, 5, 5, 6],
    mascot: [
      { x: 260, y: 1060, size: 220, pose: 'tourner' },
      { x: 260, y: 1060, size: 220, pose: 'tourner' },
      { x: 260, y: 1060, size: 220, pose: 'tourner' },
      { x: 260, y: 1060, size: 220, pose: 'tourner' },
      { x: 260, y: 1060, size: 220, pose: 'parle' },
    ],
    notes: [
      'Trois principes, devant l’objectif.',
      'Créativité : l’IA ne réécrit ni l’histoire, ni les dialogues, ni le synopsis.',
      'Transparence : « non divulgué » est accepté, chaque festival a sa source, la météo n’est jamais inventée.',
      'Contrôle humain : sous-titres validés ligne par ligne, alerte avant de générer le planning, images du Coach traitées sur le téléphone.',
      'Et ce que nous ne promettons pas encore, nous le disons.',
    ],
  },
  {
    id: 'fin',
    num: '06',
    title: 'À suivre…',
    place: 'Retour au plateau',
    question: 'Quelle est la prochaine étape ?',
    Component: Closing,
    beats: 3,
    enter: 'iris',
    seconds: 15,
    beatSeconds: [3, 6, 6],
    mascot: [
      { x: 420, y: 1000, size: 360, pose: 'salut', shadow: true },
      { x: 420, y: 1000, size: 360, pose: 'parle', shadow: true },
      { x: 420, y: 1000, size: 360, pose: 'salut', shadow: true },
    ],
    notes: [
      'Fin de la prise 02.',
      'Nous n’avons pas seulement imaginé un outil. Nous avons commencé à construire un nouvel accompagnement pour les créateurs. L’IA propose, le cinéaste décide.',
      'Encadré : tourne, déclare, fais-toi voir. Merci. (Le dépôt GitHub est à l’écran.)',
    ],
  },
];

export const TOTAL_SECONDS = DECK.reduce((s, d) => s + d.seconds, 0);
