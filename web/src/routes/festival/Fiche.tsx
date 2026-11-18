import { useEffect } from 'react';
import { useLocation, useParams } from 'react-router';
import type { AiPolicy, Festival, Passport, Project } from '@/api/types';
import { isApiError } from '@/api';
import { Button, ButtonLink, EmptyState, Icon, LoadingBlock, QueryState, useToast } from '@/components/ui';
import {
  AiPolicyChip,
  Breadcrumb,
  DeadlineChip,
  FestivalPlate,
  SourceLine,
  WithProject,
} from '@/features/festival/components/Kit';
import { aiDepartments, deadlineText, feeText, shortName } from '@/features/festival/lib/kit';
import { PiecesList, PiecesProgress } from '@/features/festival/components/Pieces';
import { useDossierContext } from '@/features/festival/hooks/useDossierContext';
import { useFestival, useFestivalSearch, useShortlist } from '@/features/festival/hooks/useFestivals';
import { deptLabel } from '@/features/festival/lib/aiDeclaration';
import {
  countReady,
  dossierPieces,
  newShortlistItem,
  setRequirementDone,
} from '@/features/festival/lib/dossier';
import { langList, RANKING_DISCLAIMER } from '@/features/festival/lib/labels';
import { defaultProfile, projectField } from '@/features/festival/lib/localStore';
import { cn } from '@/lib/cn';

const AI_POLICY_TEXT: Record<AiPolicy, string> = {
  acceptee: 'Le règlement autorise l’usage de l’IA.',
  a_declarer: 'Le règlement autorise l’IA, à condition de la déclarer.',
  interdite: 'Le règlement refuse les films faits avec de l’IA générative.',
  section_dediee: 'Les films faits entièrement par IA concourent dans une section à part.',
  non_precisee:
    'Le règlement ne dit rien sur l’IA. Ce n’est pas une autorisation : demande au festival avant de t’inscrire.',
};

function Compatibility({
  festival,
  project,
  passport,
}: {
  festival: Festival;
  project: Project;
  passport: Passport | null | undefined;
}) {
  const profile = projectField(project, 'film_profile', defaultProfile(project.format));
  // Score et raisons viennent du serveur (aucun calcul de compatibilité ici)
  const search = useFestivalSearch(
    { film: { ...profile, declared_ai_departments: aiDepartments(passport) }, q: festival.name },
    passport !== undefined,
  );
  const match = search.data?.find((m) => m.festival.id === festival.id);
  return (
    <section aria-labelledby="compat" className="flex flex-col gap-3 border-2 border-ink bg-white p-5">
      <h2 id="compat" className="text-h3">
        {project.title} et ce festival
      </h2>
      <QueryState
        query={search}
        loading={<LoadingBlock lines={2} label="Comparaison avec ton film…" />}
        errorTitle="Comparaison indisponible"
        isEmpty={() => !match}
        empty={
          <p className="text-meta text-muted-on-light">Pas de comparaison disponible pour ce festival.</p>
        }
      >
        {() => (
          <ul className="flex flex-col gap-2">
            {match!.reasons.map((r) => (
              <li key={r} className="flex items-start gap-2 text-ok-fg">
                <Icon name="check" size={18} className="mt-0.5 shrink-0" />
                <span className="text-ink">{r}</span>
              </li>
            ))}
            {match!.warnings.map((w) => (
              <li
                key={w}
                className={cn('flex items-start gap-2', match!.score === 1 ? 'text-bad-fg' : 'text-warn-fg')}
              >
                <Icon name={match!.score === 1 ? 'x' : 'alert'} size={18} className="mt-0.5 shrink-0" />
                <span className="text-ink">{w}</span>
              </li>
            ))}
          </ul>
        )}
      </QueryState>
      <p className="text-meta text-muted-on-light">{RANKING_DISCLAIMER}</p>
    </section>
  );
}

function FicheBody({
  festival,
  project,
  passport,
}: {
  festival: Festival;
  project: Project;
  passport: Passport | null | undefined;
}) {
  const { toast } = useToast();
  const { hash } = useLocation();
  const shortlist = useShortlist(project);
  const item = project.festival_shortlist.find((s) => s.festival_id === festival.id);
  const ctx = useDossierContext(project, passport);
  const pieces = dossierPieces(festival, item, ctx);
  const used = passport?.declarations.filter((d) => d.used_ai) ?? [];
  const place = [festival.city, festival.country].filter(Boolean).join(', ');

  useEffect(() => {
    if (hash === '#dossier') document.getElementById('dossier')?.scrollIntoView({ block: 'start' });
  }, [hash]);

  const add = () =>
    shortlist
      .add(newShortlistItem(festival))
      .then(() => toast({ tone: 'ok', title: 'Dossier ajouté à « Mes dossiers »' }))
      .catch(() => toast({ tone: 'bad', title: 'Le dossier n’a pas pu être créé' }));

  const facts: [string, string, string?][] = [
    ['Date limite', deadlineText(festival), festival.deadline_note ?? undefined],
    ['Inscription', feeText(festival.fee)],
    ['Durée max.', festival.max_duration_min === null ? 'Non précisée' : `${festival.max_duration_min} min`],
    ['Sous-titres', langList(festival.subtitle_langs)],
  ];

  return (
    <div className="flex flex-col gap-8">
      <Breadcrumb items={[{ label: 'Catalogue', to: '/festival' }, { label: shortName(festival) }]} />

      <section className="grid grid-cols-1 border-2 border-ink bg-white md:grid-cols-12">
        <FestivalPlate festival={festival} className="min-h-40 md:col-span-4" />
        <div className="flex flex-col gap-4 p-5 md:col-span-8 md:p-6">
          <div className="flex flex-wrap gap-2">
            <DeadlineChip festival={festival} />
            <AiPolicyChip festival={festival} />
          </div>
          <h1 className="text-[32px] leading-tight md:text-h2">{festival.name}</h1>
          <p className="text-muted-on-light">{[festival.edition, place].filter(Boolean).join(' · ')}</p>
          <div className="flex flex-wrap gap-3">
            {item ? (
              <ButtonLink to="/festival/dossiers" icon="check">
                Voir dans mes dossiers
              </ButtonLink>
            ) : (
              <Button onClick={() => void add()} loading={shortlist.pending}>
                {festival.deadline_status === 'passee'
                  ? 'Préparer pour le prochain appel'
                  : 'Préparer mon dossier'}
              </Button>
            )}
            <a
              href={festival.source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-2 border-2 border-ink bg-paper px-5 font-semibold shadow-hard-sm hover:shadow-hard"
            >
              Règlement officiel <Icon name="external" size={18} />
              <span className="sr-only">(nouvel onglet)</span>
            </a>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
        <div className="flex flex-col gap-6 lg:col-span-7">
          <section aria-labelledby="essentiel" className="flex flex-col gap-4">
            <h2 id="essentiel" className="text-h3">
              L’essentiel du règlement
            </h2>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 border-2 border-line-light bg-white p-5 sm:grid-cols-2">
              {facts.map(([k, v, note]) => (
                <div key={k}>
                  <dt className="eyebrow text-muted-on-light">{k}</dt>
                  <dd className="font-semibold">{v}</dd>
                  {note ? <dd className="text-meta text-muted-on-light">{note}</dd> : null}
                </div>
              ))}
              {festival.eligibility ? (
                <div className="sm:col-span-2">
                  <dt className="eyebrow text-muted-on-light">Films acceptés</dt>
                  <dd>{festival.eligibility}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section aria-labelledby="ia" className="flex flex-col gap-3 border-l-4 border-gold bg-white p-5">
            <h2 id="ia" className="text-h3">
              Ce que le festival demande sur l’IA
            </h2>
            <p>{festival.ai_policy_detail || AI_POLICY_TEXT[festival.ai_policy]}</p>
            {festival.ai_policy !== 'non_precisee' ? (
              <p className="text-meta text-muted-on-light">
                {passport
                  ? used.length
                    ? `Ton Passeport IA déclare : ${used.map((d) => deptLabel(d.department).toLowerCase()).join(', ')}.`
                    : 'Ton Passeport IA ne déclare aucune IA.'
                  : 'Tu n’as pas encore rempli ton Passeport IA.'}{' '}
                Le règlement ne dit pas si ce choix compte pour la sélection.
              </p>
            ) : null}
          </section>

          <Compatibility festival={festival} project={project} passport={passport} />
          <SourceLine festival={festival} />
        </div>

        <aside
          id="dossier"
          aria-labelledby="dossier-titre"
          className="flex scroll-mt-24 flex-col gap-4 border-2 border-ink bg-white p-5 shadow-hard lg:col-span-5"
        >
          <p id="dossier-titre" className="eyebrow">
            Ton dossier pour ce festival
          </p>
          {pieces.length ? (
            <>
              <PiecesProgress ready={countReady(pieces)} total={pieces.length} />
              <PiecesList
                pieces={pieces}
                busy={shortlist.pending}
                onToggle={
                  item ? (r, done) => void shortlist.replace(setRequirementDone(item, r, done)) : undefined
                }
              />
              {!item ? (
                <Button
                  className="whitespace-normal! text-left"
                  variant="secondary"
                  icon="plus"
                  onClick={() => void add()}
                  loading={shortlist.pending}
                >
                  Ajouter à mes dossiers pour cocher les pièces
                </Button>
              ) : null}
            </>
          ) : (
            <p className="text-meta text-muted-on-light">
              Le règlement ne liste pas de pièces précises : vérifie le formulaire sur le site officiel.
            </p>
          )}
          <p className="flex items-start gap-2 bg-paper p-3 text-meta">
            <Icon name="info" size={16} className="mt-0.5 shrink-0" />
            Quand tout est prêt, tu t’inscris sur le site du festival. encadré ne soumet rien et ne prend
            aucun paiement.
          </p>
        </aside>
      </div>
    </div>
  );
}

export default function Fiche() {
  const { festivalId } = useParams();
  const festival = useFestival(festivalId);
  return (
    <WithProject>
      {(project, passport) =>
        festival.isError && isApiError(festival.error) && festival.error.status === 404 ? (
          <EmptyState
            icon="film"
            title="Festival introuvable"
            action={
              <ButtonLink to="/festival" icon="arrowLeft" variant="secondary">
                Retour au catalogue
              </ButtonLink>
            }
          >
            Cette fiche n’existe pas ou plus. Le catalogue liste les festivals vérifiés.
          </EmptyState>
        ) : (
          <QueryState query={festival} loading={<LoadingBlock lines={10} label="Chargement de la fiche…" />}>
            {(f) => <FicheBody festival={f} project={project} passport={passport.data} />}
          </QueryState>
        )
      }
    </WithProject>
  );
}
