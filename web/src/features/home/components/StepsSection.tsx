import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Icon, StatusChip } from '@/components/ui';
import { cn } from '@/lib/cn';
import { CoachCapture, FestivalCapture, PassportCapture, PlannerCapture } from './StepCaptures';

type Step = {
  n: number;
  name: string;
  title: string;
  text: string;
  points: string[];
  capture: ReactNode;
  soon?: boolean;
};

const STEPS: Step[] = [
  {
    n: 1,
    name: 'Planifier',
    title: 'Quand et où tourner chaque scène.',
    text: 'Importe ton scénario : l’IA propose un découpage en scènes, tu le valides. Le planning suit la lumière, la météo et les contraintes de chaque lieu.',
    points: ['Créneaux calés sur le soleil et la météo', 'Scènes d’un même lieu regroupées', 'Feuille de service imprimable'],
    capture: <PlannerCapture />,
  },
  {
    n: 2,
    name: 'Tourner',
    title: 'Le Coach, sur ton téléphone.',
    text: 'Des repères de cadrage en direct pendant le tournage. Les images restent sur ton téléphone.',
    points: ['Les scènes du jour sous la main', 'Images traitées sur l’appareil', 'Rien n’est envoyé'],
    capture: <CoachCapture />,
    soon: true,
  },
  {
    n: 3,
    name: 'Déclarer',
    title: 'Le Passeport IA.',
    text: 'Département par département, tu déclares ce que l’IA a fait et ce que tu as décidé toi-même. Les festivals le vérifient sur une page publique.',
    points: ['Une étiquette lisible d’un coup d’œil', 'Un badge pour le générique et l’affiche', 'Une page de vérification publique'],
    capture: <PassportCapture />,
  },
  {
    n: 4,
    name: 'Diffuser',
    title: 'Le Kit Festival.',
    text: 'Trouve les festivals compatibles avec ton film, prépare chaque dossier et suis les dates limites. La soumission se fait toujours sur le site officiel du festival.',
    points: ['Filtres par durée, frais et politique IA', 'Un dossier à préparer par festival', 'Sous-titres et synopsis'],
    capture: <FestivalCapture />,
  },
];

export function StepsSection() {
  return (
    <section id="etapes" aria-labelledby="etapes-titre" className="scroll-mt-4 bg-paper">
      <div className="container-pp py-20 md:py-28">
        <p className="eyebrow text-muted-on-light">Comment ça marche</p>
        <h2 id="etapes-titre" className="mt-3 max-w-3xl text-[40px] leading-none md:text-page">
          Quatre étapes, du premier repérage au festival.
        </h2>

        <ol className="mt-16 flex flex-col gap-20 md:gap-28">
          {STEPS.map((s, i) => (
            <li key={s.n} className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-16">
              <div className={cn('lg:col-span-5', i % 2 === 1 && 'lg:order-2 lg:col-start-8')}>
                <div className="flex items-center gap-3">
                  <span className="grid size-12 place-items-center bg-ink font-display text-[24px] font-bold text-gold">
                    {s.n}
                  </span>
                  <span className="eyebrow">Étape {s.n} · {s.name}</span>
                  {s.soon ? (
                    <StatusChip tone="warn" icon="clock">
                      Bientôt
                    </StatusChip>
                  ) : null}
                </div>
                <h3 className="mt-5 text-h2">{s.title}</h3>
                <p className="mt-4 text-lead text-muted-on-light">{s.text}</p>
                <ul className="mt-6 flex flex-col gap-2">
                  {s.points.map((p) => (
                    <li key={p} className="flex items-start gap-2">
                      <Icon name="check" size={20} className="mt-0.5 shrink-0 text-action" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div className={cn('lg:col-span-6', i % 2 === 1 ? 'lg:order-1 lg:col-start-1' : 'lg:col-start-7')}>
                {s.capture}
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-20 text-meta text-muted-on-light">
          Illustrations faites avec un film fictif. Les noms de festivals sont des exemples.{' '}
          <Link to="/verifier/exemple" className="font-semibold text-ink underline underline-offset-4">
            Voir une vraie page de vérification d’exemple
          </Link>
        </p>
      </div>
    </section>
  );
}
