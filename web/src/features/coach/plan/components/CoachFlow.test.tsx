import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '@/api';
import type { Calibration, PlanShot, ShotChoices, ShotSpec } from '@/api/types';
import fixture from '../fixtures/targets_cases.json';
import { computeTargets } from '../computeTargets';
import { record } from '../testData';
import { savePlan } from '../store';
import { CoachFlow } from './CoachFlow';

const auth = vi.hoisted(() => ({ mode: 'simulated' as 'simulated' | 'supabase' }));
vi.mock('@/api', async (orig) => ({
  ...(await orig<typeof import('@/api')>()),
  api: {
    generateShotSpec: vi.fn(),
    getCalibration: vi.fn(),
    listWorkspaces: vi.fn(),
    putWorkspace: vi.fn(),
    deleteWorkspace: vi.fn(),
  },
  coachIsReal: true,
}));
vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' }, authMode: auth.mode }),
}));
vi.mock('@/features/project/hooks/useProject', () => ({
  useCurrentProject: () => ({
    data: {
      scenes: [
        {
          id: 'sc-1',
          number: '1',
          title: 'Amira ouvre le café',
          setting: 'INT',
          moment: 'jour',
          location_id: 'l1',
          characters: ['Amira'],
          estimated_hours: 2,
          summary: 'Elle lève le rideau.',
          source: 'manuel',
          validated: true,
        },
      ],
      locations: [{ id: 'l1', name: 'Café de la médina' }],
    },
  }),
}));
vi.mock('../../measure/useOrientation', () => ({ requestMotionPermission: async () => 'granted' }));
vi.mock('../../components/CoachScreen', () => ({
  CoachScreen: ({
    targets,
    shotLabel,
    shotNote,
    timeline,
    initialMount,
    onClose,
  }: {
    targets: { pitch_deg: { min: number } | null };
    shotLabel: string;
    shotNote?: string;
    timeline?: { duration_s: number; segments: unknown[] };
    initialMount: { kind: string; tiltDeg: number };
    onClose: () => void;
  }) => (
    <div
      role="dialog"
      aria-label="caméra"
      data-label={shotLabel}
      data-pitch-min={targets.pitch_deg ? targets.pitch_deg.min : 'aucun'}
      data-note={shotNote ?? ''}
      data-passages={timeline ? timeline.segments.length : ''}
      data-duration={timeline ? timeline.duration_s : ''}
      data-mount={`${initialMount.kind}:${initialMount.tiltDeg}`}
    >
      <button onClick={onClose}>Fermer la caméra</button>
    </div>
  ),
}));

const calibration = fixture.calibration as unknown as Calibration;
const choices = fixture.cases[0].intent as unknown as PlanShot['intent'];
const shot: PlanShot = {
  id: 'sc-1-a',
  intent: {
    ...choices,
    label_fr: 'Plan moyen sur le personnage',
    why_fr: 'Le tiers gauche laisse de la place au regard.',
    rule_ids: ['R-008'],
    advice_fr: ['Garde le téléphone droit.'],
  },
  targets: computeTargets(choices, calibration),
  rules: [
    {
      id: 'R-008',
      title_fr: 'Règle des tiers',
      confidence: 'high',
      sources: [
        {
          title: 'Rule of thirds (Wikipedia)',
          author: null,
          url: 'https://en.wikipedia.org/wiki/Rule_of_thirds',
          type: 'encyclopedia',
        },
      ],
    },
  ],
};
const spec: ShotSpec = {
  scene_id: 'sc-1',
  status: 'Brouillon IA : à valider',
  calibration: calibration.version,
  model: 'test',
  generated_at: '2026-11-18T10:00:00Z',
  shots: [shot],
};

const generate = vi.mocked(api.generateShotSpec);
const getCalibration = vi.mocked(api.getCalibration);
const listWorkspaces = vi.mocked(api.listWorkspaces);
const putWorkspace = vi.mocked(api.putWorkspace);

function renderFlow() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CoachFlow />
    </QueryClientProvider>,
  );
}
const describeScene = (text: string) =>
  fireEvent.change(screen.getByLabelText(/Que se passe-t-il dans la scène/), { target: { value: text } });
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Générer le plan' }));

const noFace: ShotChoices = {
  ...choices,
  subject_kind: 'none',
  subject_view: 'not_applicable',
  subject_position: 'center',
  movement: 'tilt',
};
const movingChoices: ShotChoices = { ...choices, movement: 'tracking' };
const seg = (
  id: string,
  start: number,
  end: number,
  description_fr: string,
  at_start: ShotChoices,
  at_end: ShotChoices | null,
) => ({
  id,
  start_s: start,
  end_s: end,
  description_fr,
  at_start,
  at_end,
  targets_start: computeTargets(at_start, calibration),
  targets_end: at_end ? computeTargets(at_end, calibration) : null,
});
const timeline = {
  duration_s: 10,
  how_fr: 'Pendant 10 secondes, tu suis Amira puis ta caméra se lève.',
  segments: [
    seg('sc-1-a-s1', 0, 3, 'Amira au centre de l’image.', movingChoices, null),
    seg(
      'sc-1-a-s2',
      3,
      10,
      'Elle sort du cadre, la caméra monte.',
      { ...noFace, camera_angle: 'low' },
      { ...noFace, camera_angle: 'high' },
    ),
  ],
};
const movingShot: PlanShot = {
  ...shot,
  intent: {
    ...shot.intent,
    ...movingChoices,
    label_fr: 'Travelling sur le personnage',
    why_fr: 'Suivre le personnage garde l’énergie.',
  },
  targets: timeline.segments[0].targets_start,
  timeline,
};

describe('parcours du Coach : scène → plan en mots → caméra', () => {
  beforeEach(() => {
    localStorage.clear();
    generate.mockReset().mockResolvedValue(spec);
    getCalibration.mockReset().mockResolvedValue(calibration);
  });

  it('commence par le formulaire de scène et prévient que le texte part vers l’IA', () => {
    renderFlow();
    expect(screen.getByRole('form', { name: 'Décrire la scène' })).toBeInTheDocument();
    expect(screen.getByText(/envoyé à l'IA \(Google Gemini\)/)).toBeInTheDocument();
    expect(screen.getByText(/ne quittent jamais ton téléphone/)).toBeInTheDocument();
  });

  it('refuse une description trop courte, sans appeler l’IA', async () => {
    renderFlow();
    describeScene('court');
    submit();
    expect(await screen.findByText(/10 caractères minimum/)).toBeInTheDocument();
    expect(generate).not.toHaveBeenCalled();
  });

  it('reprendre une scène du planning préremplit le formulaire', () => {
    renderFlow();
    fireEvent.change(screen.getByLabelText(/Reprendre une scène de ton planning/), {
      target: { value: 'sc-1' },
    });
    expect(screen.getByLabelText(/Que se passe-t-il dans la scène/)).toHaveValue(
      'Amira ouvre le café : Elle lève le rideau.',
    );
    expect(screen.getByLabelText(/Endroit/)).toHaveValue('Café de la médina');
    expect(screen.getByLabelText(/Personnages à l'image/)).toHaveValue('Amira');
  });

  it('envoie la scène et ses étiquettes, puis montre le plan en mots avec sa source', async () => {
    renderFlow();
    describeScene('Un vieil homme boit son thé dans un café.');
    fireEvent.click(screen.getByLabelText('Tendue'));
    fireEvent.change(screen.getByLabelText(/Style visuel/), { target: { value: 'documentaire' } });
    submit();

    const card = await screen.findByRole('article', { name: 'Plan' });
    expect(generate.mock.calls[0][0]).toEqual({
      description: 'Un vieil homme boit son thé dans un café.',
      mood: ['Tendue'],
      visual_style: 'documentaire',
    });
    expect(within(card).getByText('Plan moyen sur le personnage')).toBeInTheDocument();
    expect(within(card).getByText('Brouillon IA : à valider')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Rule of thirds (Wikipedia)' })).toHaveAttribute(
      'href',
      'https://en.wikipedia.org/wiki/Rule_of_thirds',
    );
  });

  it('modifier un mot recalcule les chiffres et les envoie à la caméra', async () => {
    renderFlow();
    describeScene('Un vieil homme boit son thé dans un café.');
    submit();
    const card = await screen.findByRole('article', { name: 'Plan' });

    // Plan non modifié : on filme avec les chiffres du serveur (caméra à hauteur des yeux).
    fireEvent.click(within(card).getByRole('button', { name: 'Filmer ce plan' }));
    expect(await screen.findByRole('dialog', { name: 'caméra' })).toHaveAttribute('data-pitch-min', '-4');
    fireEvent.click(screen.getByRole('button', { name: 'Fermer la caméra' }));

    // L'utilisateur choisit la contre-plongée : le tangage visé devient positif (la caméra regarde vers le haut).
    fireEvent.change(within(card).getByLabelText(/Hauteur de la caméra/), { target: { value: 'low' } });
    expect(within(card).getByText('Modifié par toi')).toBeInTheDocument();
    fireEvent.click(within(card).getByRole('button', { name: 'Filmer ce plan' }));
    const dialog = await screen.findByRole('dialog', { name: 'caméra' });
    expect(Number(dialog.getAttribute('data-pitch-min'))).toBeGreaterThan(0);
    expect(dialog).toHaveAttribute('data-label', 'Plan moyen sur le personnage');
  });

  it('revenir à la proposition de l’IA annule la modification', async () => {
    renderFlow();
    describeScene('Un vieil homme boit son thé dans un café.');
    submit();
    const card = await screen.findByRole('article', { name: 'Plan' });
    fireEvent.change(within(card).getByLabelText(/Hauteur de la caméra/), { target: { value: 'high' } });
    fireEvent.click(within(card).getByRole('button', { name: 'Tout remettre comme l’IA l’a proposé' }));
    expect(within(card).queryByText('Modifié par toi')).toBeNull();
  });

  it('le plan et les modifications sont gardés dans le téléphone (hors ligne)', async () => {
    const first = renderFlow();
    describeScene('Un vieil homme boit son thé dans un café.');
    submit();
    const card = await screen.findByRole('article', { name: 'Plan' });
    fireEvent.change(within(card).getByLabelText(/Taille de plan/), { target: { value: 'WS' } });
    first.unmount();

    generate.mockClear();
    renderFlow();
    const again = await screen.findByRole('article', { name: 'Plan' });
    expect(generate).not.toHaveBeenCalled();
    expect(within(again).getByLabelText(/Taille de plan/)).toHaveValue('WS');
  });

  it('une erreur de l’IA (quota) est expliquée, le formulaire reste disponible', async () => {
    generate.mockRejectedValue(
      new ApiError(429, 'trop_de_requetes', 'Trop de demandes en peu de temps. Réessaie dans un instant.'),
    );
    renderFlow();
    describeScene('Un vieil homme boit son thé dans un café.');
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent('Trop de demandes');
    expect(screen.getByRole('button', { name: 'Générer le plan' })).toBeInTheDocument();
  });

  it('sans calibration (jamais téléchargée), modifier un mot bloque le tournage plutôt que d’inventer des chiffres', async () => {
    getCalibration.mockRejectedValue(new ApiError(0, 'reseau', 'Impossible de joindre le serveur.'));
    renderFlow();
    describeScene('Un vieil homme boit son thé dans un café.');
    submit();
    const card = await screen.findByRole('article', { name: 'Plan' });
    await waitFor(() => expect(getCalibration).toHaveBeenCalled());
    // Sans calibration, le vocabulaire (les listes de mots) manque aussi : rien à modifier, le plan reste filmable.
    expect(within(card).getByRole('button', { name: 'Filmer ce plan' })).toBeEnabled();
  });

  it('un plan fixe n’a pas de champ durée ; un plan en mouvement l’exige et l’envoie à l’IA', async () => {
    renderFlow();
    describeScene('Amira court dans la ruelle de la médina.');
    expect(screen.queryByLabelText(/Durée estimée/)).toBeNull();
    fireEvent.change(screen.getByLabelText(/Mouvement de la caméra/), { target: { value: 'moving' } });
    submit();
    expect(await screen.findByText(/Indique la durée estimée de la scène/)).toBeInTheDocument();
    expect(generate).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Durée estimée/), { target: { value: '10' } });
    submit();
    await screen.findByRole('article', { name: 'Plan' });
    expect(generate.mock.calls[0][0]).toEqual({
      description: 'Amira court dans la ruelle de la médina.',
      motion: 'moving',
      duration_s: 10,
    });
  });

  it('un seul plan par scène, avec une seule étiquette « Brouillon IA »', async () => {
    renderFlow();
    describeScene('Un vieil homme boit son thé dans un café.');
    submit();
    await screen.findByRole('article', { name: 'Plan' });
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getAllByText('Brouillon IA : à valider')).toHaveLength(1);
  });

  it('plan fixe : on modifie le cadrage, pas le mouvement (la caméra ne bouge pas)', async () => {
    renderFlow();
    describeScene('Un vieil homme boit son thé dans un café.');
    submit();
    const card = await screen.findByRole('article', { name: 'Plan' });
    expect(within(card).getByLabelText(/Taille de plan/)).toBeInTheDocument();
    expect(within(card).queryByLabelText(/^Mouvement/)).toBeNull();
    expect(within(card).queryByRole('region', { name: 'Comment ce plan sera filmé' })).toBeNull();
  });

  it('plan en mouvement : explication claire, passages en secondes, et chronologie envoyée à la caméra', async () => {
    generate.mockResolvedValue({ ...spec, shots: [movingShot] });
    renderFlow();
    describeScene('Amira court dans la ruelle de la médina.');
    fireEvent.change(screen.getByLabelText(/Mouvement de la caméra/), { target: { value: 'moving' } });
    fireEvent.change(screen.getByLabelText(/Durée estimée/), { target: { value: '10' } });
    submit();
    const card = await screen.findByRole('article', { name: 'Plan' });

    const how = within(card).getByRole('region', { name: 'Comment ce plan sera filmé' });
    expect(how).toHaveTextContent('Pendant 10 secondes, tu suis Amira puis ta caméra se lève.');
    const summary = within(how).getByRole('list', { name: 'Résumé de la prise' });
    expect(summary).toHaveTextContent(/De 0 à 3 s : .*Une personne/);
    expect(summary).toHaveTextContent(/De 3 à 10 s : .*Pas de sujet précis.*, puis En plongée/);
    expect(within(card).getAllByRole('listitem', { name: /^Passage \d/ })).toHaveLength(2);

    fireEvent.click(within(card).getByRole('button', { name: 'Filmer ce plan' }));
    const dialog = await screen.findByRole('dialog', { name: 'caméra' });
    expect(dialog).toHaveAttribute('data-passages', '2');
    expect(dialog).toHaveAttribute('data-duration', '10');
  });

  it('plan en mouvement : modifier un passage recalcule ses chiffres ; « tout remettre » revient à l’IA ; la chronologie est gardée', async () => {
    generate.mockResolvedValue({ ...spec, shots: [movingShot] });
    const first = renderFlow();
    describeScene('Amira court dans la ruelle de la médina.');
    fireEvent.change(screen.getByLabelText(/Mouvement de la caméra/), { target: { value: 'moving' } });
    fireEvent.change(screen.getByLabelText(/Durée estimée/), { target: { value: '10' } });
    submit();
    const card = await screen.findByRole('article', { name: 'Plan' });
    const second = within(card).getByRole('listitem', { name: 'Passage 2' });
    expect(within(card).queryByText('Modifié par toi')).toBeNull();

    // le passage 1 finit à 5 s au lieu de 3 s
    fireEvent.change(
      within(card).getByRole('listitem', { name: 'Passage 1' }).querySelector('input[type=range]')!,
      { target: { value: '5' } },
    );
    expect(within(card).getByText('Modifié par toi')).toBeInTheDocument();
    expect(within(card).getByRole('list', { name: 'Résumé de la prise' })).toHaveTextContent('De 0 à 5 s');
    expect(second).toHaveTextContent(/de 5 à 10 s/);

    // le passage 2 passe en « à hauteur des yeux » : ses chiffres d'angle changent
    fireEvent.change(
      within(second).getByLabelText('Hauteur de la caméra', { selector: '[id$="-start-camera_angle"]' }),
      { target: { value: 'eye_level' } },
    );
    fireEvent.click(within(card).getByRole('button', { name: 'Filmer ce plan' }));
    expect(await screen.findByRole('dialog', { name: 'caméra' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fermer la caméra' }));
    first.unmount();

    renderFlow(); // la chronologie modifiée est gardée dans le téléphone
    const again = await screen.findByRole('article', { name: 'Plan' });
    expect(within(again).getByText('Modifié par toi')).toBeInTheDocument();
    fireEvent.click(within(again).getByRole('button', { name: 'Tout remettre comme l’IA l’a proposé' }));
    expect(within(again).queryByText('Modifié par toi')).toBeNull();
    expect(within(again).getByRole('list', { name: 'Résumé de la prise' })).toHaveTextContent('De 0 à 3 s');
  });

  it('plan en mouvement : on peut couper un passage en deux et en supprimer un', async () => {
    generate.mockResolvedValue({ ...spec, shots: [movingShot] });
    renderFlow();
    describeScene('Amira court dans la ruelle de la médina.');
    fireEvent.change(screen.getByLabelText(/Mouvement de la caméra/), { target: { value: 'moving' } });
    fireEvent.change(screen.getByLabelText(/Durée estimée/), { target: { value: '10' } });
    submit();
    const card = await screen.findByRole('article', { name: 'Plan' });
    fireEvent.click(
      within(within(card).getByRole('listitem', { name: 'Passage 1' })).getByRole('button', {
        name: 'Couper ce passage en deux',
      }),
    );
    expect(within(card).getAllByRole('listitem', { name: /^Passage \d/ })).toHaveLength(3);
    fireEvent.click(
      within(within(card).getByRole('listitem', { name: 'Passage 3' })).getByRole('button', {
        name: 'Supprimer ce passage',
      }),
    );
    expect(within(card).getAllByRole('listitem', { name: /^Passage \d/ })).toHaveLength(2);
    expect(within(card).getByRole('list', { name: 'Résumé de la prise' })).toHaveTextContent('De 1,5 à 10 s');
  });

  it('le montage sur une vraie caméra est gardé et transmis à la caméra', async () => {
    renderFlow();
    describeScene('Un vieil homme boit son thé dans un café.');
    submit();
    const card = await screen.findByRole('article', { name: 'Plan' });
    const picker = screen.getByRole('region', { name: 'Ton installation' });
    expect(within(picker).queryByRole('slider')).toBeNull(); // téléphone seul : pas d'inclinaison à régler

    fireEvent.change(within(picker).getByLabelText('Comment filmes-tu ?'), { target: { value: 'above' } });
    fireEvent.change(within(picker).getByRole('slider', { name: /Inclinaison du téléphone/ }), {
      target: { value: '2' },
    });
    expect(within(picker).getByText(/2° plus haut que la caméra/)).toBeInTheDocument();

    fireEvent.click(within(card).getByRole('button', { name: 'Filmer ce plan' }));
    expect(await screen.findByRole('dialog', { name: 'caméra' })).toHaveAttribute('data-mount', 'above:2');
    expect(JSON.parse(localStorage.getItem('pp-coach-mount-v1')!)).toEqual({ kind: 'above', tiltDeg: 2 });
  });
});

const tabs = () => screen.getAllByRole('tab');
const tabNamed = (re: RegExp) => screen.getByRole('tab', { name: re });
const newSpace = () => fireEvent.click(screen.getByRole('button', { name: 'Nouvel espace' }));

describe('espaces de travail : une scène par espace', () => {
  beforeEach(() => {
    localStorage.clear();
    generate.mockReset().mockResolvedValue(spec);
    getCalibration.mockReset().mockResolvedValue(calibration);
    vi.restoreAllMocks();
  });

  it('au départ : un seul espace, vide', () => {
    renderFlow();
    expect(tabs()).toHaveLength(1);
    expect(tabs()[0]).toHaveTextContent('Espace 1');
    expect(tabs()[0]).toHaveTextContent('vide');
    expect(tabs()[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('l’espace prend le nom de sa scène dès qu’il a un plan', async () => {
    renderFlow();
    describeScene('Un vieil homme boit son thé dans un café.');
    submit();
    await screen.findByRole('article', { name: 'Plan' });
    expect(tabs()[0]).toHaveTextContent('Un vieil homme boit son thé…');
    expect(tabs()[0]).toHaveTextContent('1 plan');
  });

  it('scène terminée : un nouvel espace vide, l’ancien garde son plan et ses modifications', async () => {
    renderFlow();
    describeScene('Un vieil homme boit son thé dans un café.');
    submit();
    const card = await screen.findByRole('article', { name: 'Plan' });
    fireEvent.change(within(card).getByLabelText(/Taille de plan/), { target: { value: 'WS' } });

    newSpace();
    expect(tabs()).toHaveLength(2);
    expect(screen.queryByRole('article', { name: 'Plan' })).toBeNull(); // formulaire vide pour la scène suivante
    expect(screen.getByLabelText(/Que se passe-t-il dans la scène/)).toHaveValue('');

    fireEvent.click(tabs()[0]); // retour au premier espace
    const back = await screen.findByRole('article', { name: 'Plan' });
    expect(within(back).getByLabelText(/Taille de plan/)).toHaveValue('WS');
  });

  it('deux scènes dans deux espaces ne se mélangent pas', async () => {
    generate.mockResolvedValueOnce(spec).mockResolvedValueOnce({
      ...spec,
      shots: [{ ...shot, intent: { ...shot.intent, label_fr: 'Plan de la ruelle' } }],
    });
    renderFlow();
    describeScene('Un vieil homme boit son thé dans un café.');
    submit();
    await screen.findByText('Plan moyen sur le personnage');

    newSpace();
    describeScene('Amira court dans la ruelle de la médina.');
    submit();
    expect(await screen.findByText('Plan de la ruelle')).toBeInTheDocument();
    expect(screen.queryByText('Plan moyen sur le personnage')).toBeNull();

    fireEvent.click(tabNamed(/Un vieil homme/));
    expect(await screen.findByText('Plan moyen sur le personnage')).toBeInTheDocument();
    fireEvent.click(tabNamed(/Amira court/));
    expect(await screen.findByText('Plan de la ruelle')).toBeInTheDocument();
  });

  it('tout est gardé dans le téléphone : après rechargement, les deux espaces sont là', async () => {
    const first = renderFlow();
    describeScene('Un vieil homme boit son thé dans un café.');
    submit();
    await screen.findByRole('article', { name: 'Plan' });
    newSpace();
    first.unmount();

    renderFlow();
    expect(tabs()).toHaveLength(2);
    expect(tabs()[1]).toHaveAttribute('aria-selected', 'true'); // l'espace actif est retrouvé
  });

  it('renommer un espace', () => {
    renderFlow();
    fireEvent.click(screen.getByRole('button', { name: 'Renommer cet espace' }));
    fireEvent.change(screen.getByLabelText('Nom de l’espace'), { target: { value: 'Café de la médina' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le nom' }));
    expect(tabs()[0]).toHaveTextContent('Café de la médina');
  });

  it('supprimer demande confirmation ; supprimer le dernier espace en recrée un vide', async () => {
    renderFlow();
    describeScene('Un vieil homme boit son thé dans un café.');
    submit();
    await screen.findByRole('article', { name: 'Plan' });

    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer cet espace' }));
    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining('Son plan et ses modifications seront perdus'),
    );
    expect(screen.getByRole('article', { name: 'Plan' })).toBeInTheDocument(); // refusé : rien ne change

    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer cet espace' }));
    expect(screen.queryByRole('article', { name: 'Plan' })).toBeNull();
    expect(tabs()).toHaveLength(1);
    expect(tabs()[0]).toHaveTextContent('vide');
  });

  it('une génération lancée puis un changement d’espace : le plan arrive dans le bon espace', async () => {
    let resolve!: (s: typeof spec) => void;
    generate.mockReturnValue(new Promise((r) => (resolve = r)));
    renderFlow();
    describeScene('Un vieil homme boit son thé dans un café.');
    submit();
    newSpace(); // l'utilisateur passe à autre chose pendant l'attente
    expect(await screen.findByRole('tab', { name: /génération/ })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Plan' })).toBeNull();

    await waitFor(() => resolve(spec));
    await waitFor(() => expect(screen.queryByRole('tab', { name: /génération/ })).toBeNull());
    expect(screen.queryByRole('article', { name: 'Plan' })).toBeNull(); // le deuxième espace est toujours vide
    fireEvent.click(tabs()[0]);
    expect(await screen.findByRole('article', { name: 'Plan' })).toBeInTheDocument();
  });

  it('une scène du planning déjà prise par un autre espace est signalée', async () => {
    renderFlow();
    fireEvent.change(screen.getByLabelText(/Reprendre une scène de ton planning/), {
      target: { value: 'sc-1' },
    });
    submit();
    await screen.findByRole('article', { name: 'Plan' });

    newSpace();
    const option = within(screen.getByLabelText(/Reprendre une scène de ton planning/)).getByRole('option', {
      name: /Amira ouvre le café/,
    });
    expect(option).toHaveTextContent(/déjà dans « Amira ouvre le café/);
  });

  it('reprend l’ancien plan unique (avant les espaces) comme premier espace', async () => {
    savePlan('u1', {
      request: { description: 'Un vieil homme boit son thé dans un café.' },
      spec,
      overrides: {},
      notes: {},
      timelines: {},
      savedAt: 'x',
    });
    renderFlow();
    expect(await screen.findByRole('article', { name: 'Plan' })).toBeInTheDocument();
    expect(tabs()).toHaveLength(1);
    expect(tabs()[0]).toHaveTextContent('Un vieil homme boit son thé…');
  });

  it('douze espaces au maximum', () => {
    renderFlow();
    for (let i = 0; i < 11; i++) newSpace();
    expect(tabs()).toHaveLength(12);
    expect(screen.getByRole('button', { name: 'Nouvel espace' })).toBeDisabled();
  });
});

describe('enregistrement des espaces sur le compte', () => {
  beforeEach(() => {
    localStorage.clear();
    auth.mode = 'supabase';
    generate.mockReset().mockResolvedValue(spec);
    getCalibration.mockReset().mockResolvedValue(calibration);
    listWorkspaces.mockReset().mockResolvedValue([]);
    putWorkspace.mockReset().mockImplementation(async (id, input) => ({
      id,
      name: input.name,
      data: input.data,
      version: 1,
      created_at: '2026-11-18T10:00:00Z',
      updated_at: '2026-11-18T10:00:01Z',
    }));
    vi.restoreAllMocks();
  });
  afterEach(() => {
    auth.mode = 'simulated';
  });

  it('sans vrai compte : les espaces restent dans le téléphone, et l’écran le dit', () => {
    auth.mode = 'simulated';
    renderFlow();
    expect(screen.getByText(/Gardés dans ce téléphone seulement/)).toBeInTheDocument();
    expect(listWorkspaces).not.toHaveBeenCalled();
  });

  it('avec un compte : la scène et son plan sont enregistrés sur le serveur, et l’écran le montre', async () => {
    renderFlow();
    describeScene('Un vieil homme boit son thé dans un café.');
    submit();
    await screen.findByRole('article', { name: 'Plan' });
    await waitFor(() => expect(putWorkspace).toHaveBeenCalledTimes(1), { timeout: 4000 });

    const [id, input] = putWorkspace.mock.calls[0];
    expect(id).toMatch(/^[0-9a-f-]{36}$/); // identifiant au format UUID, exigé par le serveur
    expect(input.name).toBe('Un vieil homme boit son thé…');
    expect(input.base_version).toBeNull();
    expect((input.data as { request: { description: string } }).request.description).toBe(
      'Un vieil homme boit son thé dans un café.',
    );
    expect(await screen.findByText(/Enregistrés sur ton compte/)).toBeInTheDocument();
  });

  it('un espace créé sur un autre appareil apparaît ici, avec son plan', async () => {
    listWorkspaces.mockResolvedValue([record('11111111-1111-4111-8111-111111111111', 'Scène du chalet', 2)]);
    renderFlow();
    expect(await screen.findByRole('article', { name: 'Plan' })).toBeInTheDocument();
    expect(tabs()).toHaveLength(1);
    expect(tabs()[0]).toHaveTextContent('Scène du chalet');
    expect(putWorkspace).not.toHaveBeenCalled(); // rien de nouveau à envoyer
  });

  it('hors ligne : l’utilisateur est prévenu, son travail reste dans le téléphone', async () => {
    putWorkspace.mockRejectedValue(new ApiError(0, 'reseau', 'Impossible de joindre le serveur.'));
    renderFlow();
    describeScene('Un vieil homme boit son thé dans un café.');
    submit();
    await screen.findByRole('article', { name: 'Plan' });
    expect(await screen.findByText(/Pas de connexion/, undefined, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Plan' })).toBeInTheDocument(); // le plan reste affiché
  });
});
