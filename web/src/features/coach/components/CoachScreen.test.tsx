import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_FADE_MS, DEMO_GAP_MS, DEMO_SHOW_MS, DEMO_START_MS } from '../demo';
import { SAMPLE_TARGETS } from '../measure/targets';
import { computeTargets } from '../plan/computeTargets';
import fixture from '../plan/fixtures/targets_cases.json';
import type { Calibration, ShotChoices, Timeline } from '@/api/types';
import { CoachScreen } from './CoachScreen';

vi.mock('../useCamera', async (orig) => ({
  ...(await orig<typeof import('../useCamera')>()),
  useCamera: () => ({ status: 'error', error: 'insecure' }),
}));

const calibration = fixture.calibration as unknown as Calibration;
const person = fixture.cases[0].intent as unknown as ShotChoices; // plan moyen, une personne, à hauteur des yeux
const gone: ShotChoices = { ...person, subject_kind: 'none', subject_view: 'not_applicable' };
const part = (
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
const timeline: Timeline = {
  duration_s: 10,
  how_fr: 'Pendant 10 secondes…',
  segments: [
    part('p1', 0, 3, 'Amira au centre de l’image.', person, null),
    part(
      'p2',
      3,
      10,
      'Elle sort du cadre, la caméra monte.',
      { ...gone, camera_angle: 'low' },
      { ...gone, camera_angle: 'high' },
    ),
  ],
};

const HORIZON = /Tourne le téléphone de \d+° vers la (droite|gauche)/;
const ANGLE = /(Élève|Abaisse) de \d+°/;

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
/** Avance le temps par pas de 0,25 s en renvoyant l'orientation du téléphone (caméra à l'horizontale). */
const pump = (ms: number) => {
  for (let t = 0; t < ms; t += 250) {
    act(() => {
      window.dispatchEvent(Object.assign(new Event('deviceorientation'), { beta: 90, gamma: 0, alpha: 0 }));
    });
    advance(250);
  }
};
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const setup = () => render(<CoachScreen onClose={() => undefined} targets={SAMPLE_TARGETS} />);
const MODE_TO_DEMO = 'Mode réel · passer en démo';
const setupDemo = () => {
  setup();
  click(MODE_TO_DEMO);
};

describe('CoachScreen (démonstration)', () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'],
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('affiche 9 voyants verts et aucune consigne au départ', () => {
    setupDemo();
    const dots = within(screen.getByRole('list', { name: 'Contrôles du cadre' })).getAllByRole('button');
    expect(dots).toHaveLength(9);
    dots.forEach((d) => expect(d).toHaveAccessibleName(/correct/));
    expect(screen.queryByText(HORIZON)).toBeNull();
  });

  it('les consignes apparaissent, s’effacent, puis la suivante arrive avec d’autres valeurs', () => {
    setupDemo();
    advance(DEMO_START_MS);
    expect(screen.getByText(HORIZON)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Horizon : à corriger/ })).toBeInTheDocument();

    advance(DEMO_SHOW_MS + DEMO_FADE_MS);
    expect(screen.queryByText(HORIZON)).toBeNull();
    expect(screen.getByRole('button', { name: /^Horizon : correct/ })).toBeInTheDocument();

    advance(DEMO_GAP_MS);
    expect(screen.getByText(ANGLE)).toBeInTheDocument();
  });

  it('toucher un voyant met la démo en pause et fige la consigne', () => {
    setupDemo();
    click(/^Stabilité : correct/);
    expect(screen.getByRole('button', { name: /^Stabilité : à corriger/ })).toBeInTheDocument();
    expect(screen.getByText('Stabilise l’image')).toBeInTheDocument();
    advance(60_000);
    expect(screen.getByText('Stabilise l’image')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reprendre' })).toBeInTheDocument();
  });

  it('« Pourquoi ? » met en pause et affiche l’explication', () => {
    setupDemo();
    advance(DEMO_START_MS);
    click('Pourquoi ?');
    expect(screen.getByText(/Un horizon penché/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reprendre' })).toBeInTheDocument();
  });

  it('« Ignorer » cache la consigne, la démo continue', () => {
    setupDemo();
    advance(DEMO_START_MS);
    click('Ignorer');
    expect(screen.queryByText(HORIZON)).toBeNull();
    advance(DEMO_SHOW_MS + DEMO_FADE_MS + DEMO_GAP_MS);
    expect(screen.getByText(ANGLE)).toBeInTheDocument();
  });

  it('a un bouton d’enregistrement et un accès aux réglages', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Démarrer l’enregistrement' })).toBeInTheDocument();
    click('Réglages');
    // Sans caméra réelle : le message explique pourquoi aucun curseur n'est proposé.
    expect(screen.getByRole('region', { name: 'Réglages de la caméra' })).toHaveTextContent(
      'Safari sur iPhone',
    );
  });

  it('une consigne de lumière propose « Régler », pas une consigne d’horizon', () => {
    setupDemo();
    click(/^Lumière : correct/); // met la démo en pause et passe la lumière au rouge
    expect(screen.getByRole('button', { name: 'Régler' })).toBeInTheDocument();
    click(/^Lumière : à corriger/); // retour au vert
    click(/^Horizon : correct/);
    expect(screen.queryByRole('button', { name: 'Régler' })).toBeNull();
  });

  it('la retouche de l’image est proposée, éteinte par défaut, et affiche ses curseurs quand on l’active', () => {
    // WebGL simulé : la retouche est « disponible » ; la création du programme échoue proprement.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as never);
    setup();
    click('Réglages');
    const toggle = screen.getByRole('checkbox', { name: /Retoucher l’image en direct/ });
    expect(toggle).not.toBeChecked();
    expect(screen.queryByText('Exposition (IL)')).toBeNull();
    fireEvent.click(toggle);
    const sheet = within(screen.getByRole('region', { name: 'Réglages de la caméra' }));
    for (const label of ['Exposition (IL)', 'Luminosité', 'Contraste', 'Saturation', 'Chaleur']) {
      expect(sheet.getByText(label)).toBeInTheDocument();
    }
    click('Réinitialiser');
    expect(sheet.getByRole('slider', { name: /Contraste/ })).toHaveValue('1');
  });

  it('sans WebGL : la retouche est désactivée et expliquée', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    setup();
    click('Réglages');
    expect(screen.getByRole('checkbox', { name: /Retoucher l’image en direct/ })).toBeDisabled();
    expect(screen.getByText(/n’a pas WebGL/)).toBeInTheDocument();
  });

  it('mode réel par défaut : sans capteurs ni visage, aucun voyant n’est présenté comme bon', () => {
    setup();
    expect(screen.getByRole('button', { name: MODE_TO_DEMO })).toBeInTheDocument();
    const dots = within(screen.getByRole('list', { name: 'Contrôles du cadre' })).getAllByRole('img');
    expect(dots).toHaveLength(9);
    dots.forEach((d) => expect(d).toHaveAccessibleName(/non mesuré/));
    expect(screen.queryByText(/Abaisse|Élève/)).toBeNull();
  });

  it('mode réel : un angle mesuré trop haut déclenche « Abaisse de 6° » après un court délai', () => {
    setup();
    // Téléphone avec la caméra 10° trop haute (beta = 100°) ; la cible du plan est -4° à +4°.
    act(() => {
      window.dispatchEvent(Object.assign(new Event('deviceorientation'), { beta: 100, gamma: 0, alpha: 0 }));
    });
    advance(200);
    expect(screen.queryByText('Abaisse de 6°')).toBeNull(); // pas encore : anti-clignotement
    expect(screen.getByRole('img', { name: /^Angle : correct/ })).toBeInTheDocument();
    advance(700);
    expect(screen.getByText('Abaisse de 6°')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /^Angle : à corriger/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /^Horizon : correct/ })).toBeInTheDocument();
  });

  it('les mesures en direct s’affichent à la demande', () => {
    setup();
    click('Réglages');
    fireEvent.click(screen.getByRole('checkbox', { name: /Afficher les mesures en direct/ }));
    const hud = screen.getByLabelText('Mesures en direct');
    expect(hud).toHaveTextContent('aucun signal');
    expect(hud).toHaveTextContent('Visage : aucun');
  });

  it('mode réel : une ligne toujours visible donne luminosité, contraste et chaleur', () => {
    setup();
    expect(screen.getByLabelText('Mesures de l’image')).toHaveTextContent('Mesure de l’image…');
    click('Réglages');
    fireEvent.click(screen.getByRole('checkbox', { name: /Afficher les mesures en direct/ }));
    expect(screen.queryByLabelText('Mesures de l’image')).toBeNull(); // le relevé complet la remplace
    expect(screen.getByLabelText('Mesures en direct')).toBeInTheDocument();
  });

  it('plan en mouvement : les secondes font changer les cibles (visage au centre, puis plus de visage et caméra qui monte puis descend)', () => {
    render(
      <CoachScreen
        onClose={() => undefined}
        targets={timeline.segments[0].targets_start}
        timeline={timeline}
        shotNote="travelling arrière"
      />,
    );
    const strip = screen.getByRole('region', { name: 'Chronologie du plan' });
    expect(strip).toHaveTextContent('Prêt');
    expect(strip).toHaveTextContent('Passage 1/2');
    expect(strip).toHaveTextContent('Le décompte démarre quand tu lances l’enregistrement');
    expect(screen.queryByRole('note')).toBeNull(); // plus de bandeau « pas de consigne de cadrage »

    // Passage 1 (0–3 s) : un visage est attendu, la caméra à l'horizontale
    pump(300);
    expect(screen.getByRole('img', { name: /^Position : non mesuré/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /^Angle : correct/ })).toBeInTheDocument();

    click('Répéter sans enregistrer'); // le décompte démarre : t = 0
    expect(screen.getByRole('button', { name: 'Arrêter la répétition' })).toBeInTheDocument();
    pump(1000); // t = 1 s
    expect(strip).toHaveTextContent('Amira au centre de l’image.');

    // Passage 2 (3–10 s) : plus de visage, caméra de la contre-plongée à la plongée
    pump(3000); // t = 4 s
    expect(strip).toHaveTextContent('Passage 2/2');
    expect(strip).toHaveTextContent('Elle sort du cadre, la caméra monte.');
    expect(screen.getByRole('img', { name: /^Position : sans objet/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /^Tête : sans objet/ })).toBeInTheDocument();
    expect(screen.getByText(/Élève de \d+°/)).toBeInTheDocument(); // téléphone à plat, on vise vers le haut

    pump(5500); // t = 9,5 s : la cible a glissé vers la plongée
    expect(screen.getByText(/Abaisse de \d+°/)).toBeInTheDocument();
    expect(screen.queryByText(/Élève de/)).toBeNull();

    pump(1000); // t > 10 s
    expect(strip).toHaveTextContent('Plan terminé');
    expect(screen.getByRole('button', { name: 'Répéter à nouveau' })).toBeInTheDocument();
  });

  it('plan en mouvement : arrêter la répétition revient au cadrage de départ', () => {
    render(
      <CoachScreen
        onClose={() => undefined}
        targets={timeline.segments[0].targets_start}
        timeline={timeline}
      />,
    );
    click('Répéter sans enregistrer');
    pump(4000);
    expect(screen.getByRole('region', { name: 'Chronologie du plan' })).toHaveTextContent('Passage 2/2');
    click('Arrêter la répétition');
    expect(screen.getByRole('region', { name: 'Chronologie du plan' })).toHaveTextContent('Passage 1/2');
  });

  it('plan fixe : pas de chronologie', () => {
    setup();
    expect(screen.queryByRole('region', { name: 'Chronologie du plan' })).toBeNull();
  });

  it('montage sur caméra : une inclinaison de +8° corrige l’angle (10° du téléphone = 2° pour la caméra)', () => {
    const tilt = () =>
      act(() => {
        window.dispatchEvent(
          Object.assign(new Event('deviceorientation'), { beta: 100, gamma: 0, alpha: 0 }),
        );
      });
    const withoutMount = render(<CoachScreen onClose={() => undefined} targets={SAMPLE_TARGETS} />);
    tilt();
    advance(900);
    expect(screen.getByText('Abaisse de 6°')).toBeInTheDocument(); // sans montage : trop haut
    withoutMount.unmount();

    render(
      <CoachScreen
        onClose={() => undefined}
        targets={SAMPLE_TARGETS}
        initialMount={{ kind: 'above', tiltDeg: 8 }}
      />,
    );
    tilt();
    advance(900);
    expect(screen.queryByText(/Abaisse/)).toBeNull();
    expect(screen.getByRole('img', { name: /^Angle : correct/ })).toBeInTheDocument();
  });

  it('le montage se règle aussi depuis les réglages de la caméra', () => {
    const onMountChange = vi.fn();
    render(<CoachScreen onClose={() => undefined} targets={SAMPLE_TARGETS} onMountChange={onMountChange} />);
    click('Réglages');
    fireEvent.change(screen.getByLabelText('Comment filmes-tu ?'), { target: { value: 'below' } });
    expect(onMountChange).toHaveBeenCalledWith({ kind: 'below', tiltDeg: 0 });
    fireEvent.change(screen.getByRole('slider', { name: /Inclinaison/ }), { target: { value: '-2' } });
    expect(onMountChange).toHaveBeenLastCalledWith({ kind: 'below', tiltDeg: -2 });
  });

  it('le tiroir latéral règle contraste et chaleur et active la retouche sans ouvrir les réglages', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as never);
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Contraste · Chaleur/ }));
    fireEvent.change(
      within(screen.getByRole('region', { name: 'Contraste et chaleur' })).getByRole('slider', {
        name: /Contraste/,
      }),
      { target: { value: '1.3' } },
    );
    click('Réglages');
    expect(screen.getByRole('checkbox', { name: /Retoucher l’image en direct/ })).toBeChecked();
    const sheet = within(screen.getByRole('region', { name: 'Réglages de la caméra' }));
    expect(sheet.getByRole('slider', { name: /Contraste/ })).toHaveValue('1.3'); // même réglage, deux endroits
  });

  it('sans WebGL, pas de tiroir (il activerait une retouche impossible)', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    setup();
    expect(screen.queryByRole('button', { name: /Contraste · Chaleur/ })).toBeNull();
  });

  it('sans HTTPS : message clair, mais les voyants restent utilisables', () => {
    setup();
    expect(screen.getByRole('alert')).toHaveTextContent('HTTPS');
  });

  it('« Fermer » appelle onClose', () => {
    const onClose = vi.fn();
    render(<CoachScreen onClose={onClose} targets={SAMPLE_TARGETS} />);
    click('Fermer le Coach');
    expect(onClose).toHaveBeenCalled();
  });
});
