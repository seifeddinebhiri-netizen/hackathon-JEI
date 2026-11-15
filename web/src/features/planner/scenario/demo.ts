import type { Analysis } from './api';

export const EXAMPLE_TITLE = 'Le premier jour';
export const EXAMPLE_CONTENT = `INT. CAFÉ – JOUR

YACINE, 24 ans, entre dans un petit café de Tunis. Il observe les clients et s'assoit près de la fenêtre.
Le SERVEUR s'approche avec un carnet.

SERVEUR
Bonjour, qu'est-ce que je vous sers ?

YACINE
Un café, s'il vous plaît.

EXT. RUE DE TUNIS – SOIR

Yacine quitte le café et traverse une rue animée. Une voiture passe derrière lui.`;

export const DEMO: Analysis = {
  title: EXAMPLE_TITLE,
  status: 'Brouillon IA : à valider',
  simulated: true,
  scenes: [
    {
      number: 1,
      heading: 'INT. CAFÉ – JOUR',
      setting: 'INT',
      time_of_day: 'DAY',
      location: 'Petit café de Tunis',
      summary:
        'Yacine entre, observe les clients, s’assoit près de la fenêtre et commande un café au serveur.',
      characters: ['YACINE', 'SERVEUR'],
      props: ['Carnet'],
      technical_requirements: [],
      production_challenges: [],
      missing_information: ['Le café exact et le nombre de clients ne sont pas précisés.'],
      inferences: ['Les clients pourraient nécessiter de la figuration.'],
      suggestions: ['Vérifier les autorisations du café et les conditions de prise de son.'],
    },
    {
      number: 2,
      heading: 'EXT. RUE DE TUNIS – SOIR',
      setting: 'EXT',
      time_of_day: 'DUSK',
      location: 'Rue animée de Tunis',
      summary: 'Yacine quitte le café et traverse la rue. Une voiture passe derrière lui.',
      characters: ['YACINE'],
      props: ['Voiture'],
      technical_requirements: [],
      production_challenges: [],
      missing_information: ['La rue exacte et la lumière attendue au « soir » sont à préciser.'],
      inferences: ['« Soir » est interprété ici comme crépuscule ; à confirmer.'],
      suggestions: ['Préparer la sécurité de la traversée et vérifier les autorisations.'],
    },
  ],
  characters: [
    { name: 'YACINE', description: '24 ans.', scenes: [1, 2], production_observations: [] },
    { name: 'SERVEUR', description: 'S’approche avec un carnet.', scenes: [1], production_observations: [] },
  ],
};
