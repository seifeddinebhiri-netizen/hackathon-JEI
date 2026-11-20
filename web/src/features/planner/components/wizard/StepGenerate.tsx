import { differenceInCalendarDays, parseISO } from 'date-fns';
import { useNavigate } from 'react-router';
import type { Project } from '@/api/types';
import { ButtonLink, Icon, type IconName } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { FORECAST_HORIZON_DAYS } from '../../lib/rules';
import { GenerateScheduleButton } from '../GenerateScheduleButton';

function Row({ icon, ok, children }: { icon: IconName; ok: boolean | 'warn'; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 py-3">
      <span
        className={cn(
          'grid size-8 shrink-0 place-items-center border-2',
          ok === true
            ? 'border-ok-fg bg-ok-bg text-ok-fg'
            : ok === 'warn'
              ? 'border-warn-fg bg-warn-bg text-warn-fg'
              : 'border-bad-fg bg-bad-bg text-bad-fg',
        )}
      >
        <Icon name={ok === true ? 'check' : icon} size={16} />
      </span>
      <div className="pt-1">{children}</div>
    </li>
  );
}

export function StepGenerate({ project }: { project: Project }) {
  const navigate = useNavigate();
  const { scenes, locations, people, shooting_window: w } = project;
  const validated = scenes.filter((s) => s.validated).length;
  const noLocation = scenes.filter((s) => !locations.some((l) => l.id === s.location_id)).length;
  const noAddress = locations.filter((l) => !l.address.trim()).length;
  const toAsk = locations.filter((l) => l.permit === 'a_demander');
  const days = differenceInCalendarDays(parseISO(w.to), parseISO(w.from)) + 1;
  const beyond = Math.max(0, differenceInCalendarDays(parseISO(w.to), new Date()) - FORECAST_HORIZON_DAYS);
  const actorsMissing = people.filter((p) => p.kind === 'acteur' && !p.name.trim()).length;
  const hours = scenes.reduce((n, s) => n + s.estimated_hours, 0);

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
      <section aria-labelledby="recap-titre" className="lg:col-span-7">
        <h2 id="recap-titre" className="text-h2">
          Avant de générer
        </h2>
        <ul className="mt-4 divide-y-2 divide-line-light border-y-2 border-ink">
          <Row
            icon="film"
            ok={scenes.length > 0 && validated === scenes.length ? true : scenes.length ? 'warn' : false}
          >
            <p className="font-semibold">
              {scenes.length} scènes · {validated} relues
            </p>
            <p className="text-meta text-muted-on-light">{hours} h de tournage estimées au total.</p>
          </Row>
          <Row icon="pin" ok={noLocation === 0 && noAddress === 0 ? true : noLocation ? false : 'warn'}>
            <p className="font-semibold">{locations.length} lieux</p>
            <p className="text-meta text-muted-on-light">
              {noLocation ? `${noLocation} scène(s) sans lieu. ` : ''}
              {noAddress
                ? `${noAddress} lieu(x) sans adresse : position approximative pour le soleil.`
                : 'Tous localisés.'}
            </p>
          </Row>
          <Row icon="doc" ok={toAsk.length === 0 ? true : 'warn'}>
            <p className="font-semibold">
              {toAsk.length ? `${toAsk.length} autorisation(s) à demander` : 'Autorisations en ordre'}
            </p>
            {toAsk.length ? (
              <p className="text-meta text-muted-on-light">
                {toAsk.map((l) => l.name).join(', ')} : signalé en alerte.
              </p>
            ) : null}
          </Row>
          <Row icon="calendar" ok={beyond === 0 ? true : 'warn'}>
            <p className="font-semibold">
              Du {formatDate(w.from)} au {formatDate(w.to)} · {days} jours · {project.max_hours_per_day} h max
              par jour
            </p>
            {beyond ? (
              <p className="text-meta text-muted-on-light">
                Les {Math.min(beyond, days)} derniers jours dépassent l’horizon de prévision (
                {FORECAST_HORIZON_DAYS} jours) : ils seront marqués « Météo à revérifier ». Seules la lumière
                et les contraintes des lieux comptent.
              </p>
            ) : null}
          </Row>
          <Row icon="users" ok={actorsMissing === 0 ? true : 'warn'}>
            <p className="font-semibold">
              {actorsMissing ? `${actorsMissing} rôle(s) sans acteur` : 'Tous les rôles sont distribués'}
            </p>
            <p className="text-meta text-muted-on-light">
              Pour les feuilles de service. Ne bloque pas le planning.
            </p>
          </Row>
        </ul>
      </section>

      <aside className="lg:col-span-5">
        <div className="flex flex-col gap-4 border-2 border-ink bg-ink p-6 text-paper shadow-hard-gold">
          <p className="eyebrow text-gold">Brouillon IA</p>
          <p className="font-display text-h3 font-bold">L’outil propose, tu ajustes.</p>
          <ul className="flex flex-col gap-2 text-meta text-muted-on-dark">
            <li>Scènes extérieures sur les jours sans pluie ni vent fort.</li>
            <li>Lever du soleil, lumière du soir et nuit calés sur le soleil.</li>
            <li>Scènes d’un même lieu regroupées le même jour.</li>
            <li>Horaires d’accès et jours interdits respectés.</li>
          </ul>
          <GenerateScheduleButton
            project={project}
            size="lg"
            onDone={() => navigate('/planner/calendrier')}
          />
          {scenes.length === 0 ? (
            <p className="text-meta text-muted-on-dark">Ajoute au moins une scène pour générer.</p>
          ) : null}
          {project.schedule ? (
            <ButtonLink to="/planner/calendrier" variant="on-dark" iconRight="arrowRight">
              Ouvrir le planning actuel
            </ButtonLink>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
