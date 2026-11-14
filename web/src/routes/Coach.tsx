import { QRCodeSVG } from 'qrcode.react';
import type { Project } from '@/api/types';
import { brand } from '@/app/brand';
import {
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  Icon,
  LoadingBlock,
  PageHeader,
  PhotoFrame,
  StatusChip,
  useToast,
  type IconName,
} from '@/components/ui';
import { MomentTag, SettingTag } from '@/features/planner/components/Tags';
import { useCurrentProject } from '@/features/project/hooks/useProject';
import { env } from '@/lib/env';
import { formatDayLong, formatTime, isoDay } from '@/lib/format';
import { copyToClipboard } from '@/lib/print';
import { useMediaQuery } from '@/lib/useMediaQuery';

const PROMISES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'eye',
    title: 'Des repères de cadrage en direct',
    text: 'Pendant la prise, sur l’écran de ton téléphone. Le Coach suggère, tu décides du plan.',
  },
  {
    icon: 'phone',
    title: 'Images traitées sur l’appareil',
    text: 'L’analyse se fait dans le téléphone, sans connexion nécessaire.',
  },
  { icon: 'lock', title: 'Rien n’est envoyé', text: 'Aucune image ni vidéo ne quitte ton téléphone.' },
];

function PrivacyNote() {
  return (
    <p className="flex items-start gap-2 border-2 border-ink bg-gold-soft p-4">
      <Icon name="lock" size={20} className="mt-0.5 shrink-0" />
      <span>
        <strong>Confidentialité :</strong> le Coach traitera les images sur ton téléphone. Rien n’est envoyé,
        rien n’est conservé par {brand.name}.
      </span>
    </p>
  );
}

/** Scènes du jour (ou du prochain jour de tournage), tirées de la feuille de service. */
function TodayScenes({ project }: { project: Project }) {
  const today = isoDay(new Date());
  const days = project.schedule?.days ?? [];
  const day = days.find((d) => d.date === today) ?? days.find((d) => d.date > today);
  if (!day) {
    return (
      <EmptyState icon="calendar" title="Pas de tournage prévu">
        Les scènes du jour apparaîtront ici dès que ton planning sera prêt.
      </EmptyState>
    );
  }
  const isToday = day.date === today;
  return (
    <section aria-labelledby="scenes-jour" className="border-2 border-ink bg-white">
      <div className="border-b-2 border-ink p-4">
        <p id="scenes-jour" className="eyebrow text-muted-on-light">
          {isToday ? 'Aujourd’hui' : 'Prochain tournage'}
        </p>
        <p className="font-display text-h3 font-bold first-letter:uppercase">{formatDayLong(day.date)}</p>
        <p className="text-meta text-muted-on-light">Rendez-vous à {day.call_time}</p>
      </div>
      <ol className="divide-y-2 divide-line-light">
        {day.scenes.map((s) => {
          const scene = project.scenes.find((x) => x.id === s.scene_id);
          if (!scene) return null;
          return (
            <li key={s.scene_id} className="flex flex-col gap-1 p-4">
              <p className="font-mono text-label">
                {formatTime(s.start)} → {formatTime(s.end)}
              </p>
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">Sc. {scene.number}</span>
                <SettingTag setting={scene.setting} />
                <MomentTag moment={scene.moment} />
              </p>
              <p>{scene.title}</p>
            </li>
          );
        })}
      </ol>
      <div className="border-t-2 border-ink p-4">
        <ButtonLink to={`/planner/jour/${day.date}`} variant="secondary" size="sm" icon="doc">
          Feuille de service
        </ButtonLink>
      </div>
    </section>
  );
}

function CoachDesktop() {
  const { toast } = useToast();
  const url = `${env.publicAppUrl.replace(/\/$/, '')}/coach`;
  const local = /localhost|127\.0\.0\.1/.test(url);
  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
      <div className="flex flex-col gap-8 lg:col-span-7">
        <ul className="flex flex-col divide-y-2 divide-line-light border-y-2 border-ink">
          {PROMISES.map((p) => (
            <li key={p.title} className="flex items-start gap-4 py-5">
              <span className="grid size-11 shrink-0 place-items-center bg-gold">
                <Icon name={p.icon} size={22} />
              </span>
              <div>
                <p className="font-display text-h3 font-bold">{p.title}</p>
                <p className="mt-1 text-muted-on-light">{p.text}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-muted-on-light">
          Le Coach donnera des conseils de prise de vue (type de plan, hauteur de caméra, inclinaison). Le
          Planner, lui, s’occupe de quand et où tourner.
        </p>
        <PhotoFrame photo="coach" ratio="16:10" sizes="(min-width: 1024px) 55vw, 100vw" />
      </div>

      <aside className="lg:col-span-5">
        <div className="sticky top-24 flex flex-col items-start gap-5 border-2 border-ink bg-ink p-6 text-paper shadow-hard-gold">
          <p className="eyebrow text-gold">Ouvre-le sur ton téléphone</p>
          <div className="bg-white p-4">
            <QRCodeSVG
              value={url}
              size={200}
              level="M"
              bgColor="#ffffff"
              fgColor="#121110"
              title={`QR code vers ${url}`}
            />
          </div>
          <p className="font-mono text-label break-all text-muted-on-dark">{url}</p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="on-dark"
              icon="copy"
              onClick={() =>
                void copyToClipboard(url).then((ok) =>
                  toast(
                    ok ? { tone: 'ok', title: 'Lien copié' } : { tone: 'bad', title: 'Copie impossible' },
                  ),
                )
              }
            >
              Copier le lien
            </Button>
          </div>
          {local ? (
            <p className="text-meta text-muted-on-dark">
              Démo locale : pour scanner depuis un téléphone, mets l’adresse réseau de l’ordinateur dans
              VITE_PUBLIC_APP_URL.
            </p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function CoachMobile({ project }: { project?: Project }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="border-2 border-ink bg-ink p-5 text-paper">
        <StatusChip tone="gold" icon="clock">
          Bientôt
        </StatusChip>
        <p className="mt-3 font-display text-h2 leading-tight font-bold">Coach bientôt disponible</p>
        <p className="mt-2 text-muted-on-dark">
          Des repères de cadrage en direct, ici même. En attendant, voici tes scènes.
        </p>
      </div>
      {project ? <TodayScenes project={project} /> : null}
      <PrivacyNote />
    </div>
  );
}

export default function Coach() {
  const desktop = useMediaQuery('(min-width: 768px)');
  const project = useCurrentProject();
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Étape 2 · Tourner"
        title="Le Coach"
        lead={
          desktop
            ? 'Un assistant de cadrage sur ton téléphone, pendant le tournage. Il arrive bientôt.'
            : undefined
        }
        actions={
          desktop ? (
            <StatusChip tone="warn" icon="clock">
              Bientôt disponible
            </StatusChip>
          ) : undefined
        }
      />
      {desktop ? (
        <>
          <CoachDesktop />
          <PrivacyNote />
        </>
      ) : project.isPending ? (
        <LoadingBlock />
      ) : project.isError ? (
        <>
          <ErrorState error={project.error} onRetry={() => void project.refetch()} />
          <CoachMobile />
        </>
      ) : (
        <CoachMobile project={project.data} />
      )}
    </div>
  );
}
