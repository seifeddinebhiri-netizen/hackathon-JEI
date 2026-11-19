import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router';
import type { Festival, Passport, Project } from '@/api/types';
import { ErrorState, Icon, LoadingBlock, PageHeader, StatusChip } from '@/components/ui';
import { useProjectPassport } from '@/features/passport/hooks/usePassport';
import { NoProject } from '@/features/project/components/NoProject';
import { useCurrentProject, useCurrentProjectId } from '@/features/project/hooks/useProject';
import { cn } from '@/lib/cn';
import { daysUntil, formatDate } from '@/lib/format';
import { useKit, withKit } from '../hooks/useKit';
import { hostOf, shortName } from '../lib/kit';
import {
  AI_POLICY_ICONS,
  AI_POLICY_LABELS,
  AI_POLICY_TONES,
  DEADLINE_ICONS,
  DEADLINE_LABELS,
  DEADLINE_TONES,
} from '../lib/labels';

/** En-tête du Kit + onglets « Catalogue » et « Mes dossiers ». */
export function KitHeader({
  catalogueCount,
  dossierCount,
}: {
  catalogueCount?: number;
  dossierCount: number;
}) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Étape 4 · Diffuser"
        title="Kit Festival"
        lead="Trouve les festivals faits pour ton film, puis prépare chaque dossier pièce par pièce. Tu t’inscris toujours sur le site officiel du festival."
      />
      <nav
        aria-label="Kit Festival"
        className="flex flex-wrap items-end gap-x-1 gap-y-3 border-b-2 border-ink"
      >
        <KitTab to="/festival" end count={catalogueCount}>
          Catalogue
        </KitTab>
        <KitTab to="/festival/dossiers" count={dossierCount}>
          Mes dossiers
        </KitTab>
        <p className="ml-auto hidden pb-3 text-meta text-muted-on-light lg:block">
          Sous-titres, synopsis, déclaration IA et page film s’ouvrent depuis chaque dossier.
        </p>
      </nav>
    </div>
  );
}

function KitTab({
  to,
  end,
  count,
  children,
}: {
  to: string;
  end?: boolean;
  count?: number;
  children: ReactNode;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'eyebrow -mb-0.5 inline-flex min-h-11 items-center gap-2 border-b-4 px-4 py-3',
          isActive
            ? 'border-ink bg-white text-ink'
            : 'border-transparent text-muted-on-light hover:border-line-light hover:text-ink',
        )
      }
    >
      {children}
      {count !== undefined ? (
        <span className="bg-ink px-1.5 py-0.5 text-paper" aria-label={`(${count})`}>
          {count}
        </span>
      ) : null}
    </NavLink>
  );
}

/** Fil d'Ariane des écrans ouverts depuis un dossier. */
export function Breadcrumb({ items, dark }: { items: { label: string; to?: string }[]; dark?: boolean }) {
  return (
    <nav aria-label="Fil d'Ariane">
      <ol className="flex flex-wrap items-center gap-x-2 text-meta">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-2">
            {i > 0 ? (
              <span aria-hidden className={dark ? 'text-muted-on-dark' : 'text-muted-on-light'}>
                /
              </span>
            ) : null}
            {it.to ? (
              <Link
                to={it.to}
                className={cn(
                  'inline-flex min-h-11 items-center font-semibold underline underline-offset-4',
                  dark ? 'text-paper hover:text-gold' : 'hover:text-action',
                )}
              >
                {it.label}
              </Link>
            ) : (
              <span aria-current="page" className={dark ? 'text-muted-on-dark' : 'text-muted-on-light'}>
                {it.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * Charge le projet courant, ses données du Kit (dossiers, pièces, synopsis) et son Passeport ;
 * affiche le chargement, l'erreur et l'absence de projet. Le projet transmis contient les
 * dossiers et les champs du film lus dans le Kit.
 */
export function WithProject({
  children,
  dark,
}: {
  children: (
    project: Project,
    passport: { data: Passport | null | undefined; isError: boolean },
  ) => ReactNode;
  dark?: boolean;
}) {
  const projectId = useCurrentProjectId();
  const project = useCurrentProject();
  const kit = useKit(project.data?.id);
  const passport = useProjectPassport(project.data?.id);
  if (!projectId)
    return <NoProject>Le Kit Festival prépare les dossiers d’un film : crée d’abord ton projet.</NoProject>;
  if (project.isPending || kit.isPending)
    return (
      <LoadingBlock
        lines={8}
        label={project.isPending ? 'Chargement du projet…' : 'Chargement de tes dossiers…'}
        className={dark ? 'p-6' : undefined}
      />
    );
  if (project.isError)
    return (
      <ErrorState
        title="Le projet n’a pas pu être chargé"
        error={project.error}
        onRetry={() => void project.refetch()}
      />
    );
  if (kit.isError)
    return (
      <ErrorState
        title="Tes dossiers n’ont pas pu être chargés"
        error={kit.error}
        onRetry={() => void kit.refetch()}
      />
    );
  return <>{children(withKit(project.data, kit.data), { data: passport.data, isError: passport.isError })}</>;
}

const PLATES = ['bg-ink text-white', 'bg-brand-red text-white', 'bg-gold text-ink'] as const;

/**
 * Vignette typographique : jamais de logo officiel, une plaque avec le nom et le lieu.
 * Couleur stable par festival (encre, rouge ou or).
 */
export function FestivalPlate({ festival, className }: { festival: Festival; className?: string }) {
  const hash = [...festival.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const place = [festival.city, festival.country].filter(Boolean).join(' · ');
  return (
    <div aria-hidden className={cn('flex flex-col justify-between p-4', PLATES[hash % 3], className)}>
      <span className="eyebrow opacity-90">{place}</span>
      <span className="font-display text-h3 leading-tight font-bold break-words">{shortName(festival)}</span>
      <span className="block h-1.5 w-12 bg-current" />
    </div>
  );
}

export function DeadlineChip({ festival }: { festival: Festival }) {
  const s = festival.deadline_status;
  const d = festival.deadline && s === 'ouverte' ? daysUntil(festival.deadline) : null;
  return (
    <StatusChip
      tone={DEADLINE_TONES[s]}
      icon={DEADLINE_ICONS[s]}
      title={festival.deadline ? `Date limite : ${formatDate(festival.deadline)}` : undefined}
    >
      {DEADLINE_LABELS[s]}
      {d !== null ? ` · J-${d}` : ''}
    </StatusChip>
  );
}

export function AiPolicyChip({ festival }: { festival: Festival }) {
  return (
    <StatusChip
      tone={AI_POLICY_TONES[festival.ai_policy]}
      icon={AI_POLICY_ICONS[festival.ai_policy]}
      className={festival.ai_policy === 'non_precisee' ? 'border-dashed' : undefined}
    >
      {AI_POLICY_LABELS[festival.ai_policy]}
    </StatusChip>
  );
}

export function SourceLine({ festival, className }: { festival: Festival; className?: string }) {
  return (
    <p className={cn('flex items-start gap-1.5 text-meta text-muted-on-light', className)}>
      <Icon name="check" size={14} className="mt-1 shrink-0" />
      <span>
        Source{' '}
        <a
          href={festival.source_url}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4 hover:text-action"
        >
          {hostOf(festival.source_url)}
        </a>
        , vérifiée le {formatDate(festival.checked_at)}
      </span>
    </p>
  );
}
