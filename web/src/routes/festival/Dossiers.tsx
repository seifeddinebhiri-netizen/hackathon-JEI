import type {
  Festival,
  FestivalRequirement,
  Passport,
  Project,
  ShortlistItem,
  ShortlistStatus,
} from '@/api/types';
import {
  Button,
  ButtonLink,
  EmptyState,
  Field,
  LoadingBlock,
  QueryState,
  Select,
  StatusChip,
  useToast,
} from '@/components/ui';
import { KitHeader, WithProject } from '@/features/festival/components/Kit';
import { feeText, shortName } from '@/features/festival/lib/kit';
import { PiecesList, PiecesProgress } from '@/features/festival/components/Pieces';
import { useDossierContext } from '@/features/festival/hooks/useDossierContext';
import { useShortlist, useShortlistFestivals } from '@/features/festival/hooks/useFestivals';
import {
  countReady,
  dossierPieces,
  PIECE_STATE_LABELS,
  sharedPieces,
  type Piece,
  type PieceState,
} from '@/features/festival/lib/dossier';
import {
  SHORTLIST_STATUS_ICONS,
  SHORTLIST_STATUS_LABELS,
  SHORTLIST_STATUS_TONES,
  SHORTLIST_STATUSES,
} from '@/features/festival/lib/labels';
import type { ChipTone } from '@/components/ui';
import { daysUntil, formatDate } from '@/lib/format';

const STATE_TONES: Record<PieceState, ChipTone> = { bloquant: 'bad', a_faire: 'warn', pret: 'ok' };
const GROUP = { ouverte: 0, a_confirmer: 1, passee: 2 } as const;

function byDeadline(a: Festival, b: Festival): number {
  const g = GROUP[a.deadline_status] - GROUP[b.deadline_status];
  if (g) return g;
  return (a.deadline ?? '').localeCompare(b.deadline ?? '');
}

function deadlineLabel(f: Festival): { text: string; tone: ChipTone } {
  if (f.deadline_status === 'ouverte' && f.deadline) {
    const d = daysUntil(f.deadline);
    return { text: `J-${d} · ${formatDate(f.deadline)}`, tone: d <= 14 ? 'bad' : 'ok' };
  }
  if (f.deadline_status === 'a_confirmer') return { text: 'Date à confirmer', tone: 'warn' };
  return { text: 'Prochain appel', tone: 'neutral' };
}

function DossierCard({
  festival,
  item,
  pieces,
  busy,
  onChange,
  onTogglePiece,
  onRemove,
}: {
  festival: Festival;
  item: ShortlistItem;
  pieces: Piece[];
  busy: boolean;
  onChange: (item: ShortlistItem) => void;
  /** Une pièce cochée ici l'est pour tous les dossiers qui la demandent. */
  onTogglePiece: (r: FestivalRequirement, done: boolean) => void;
  onRemove: () => void;
}) {
  const dl = deadlineLabel(festival);
  const meta = [
    festival.city ?? festival.country,
    festival.max_duration_min ? `${festival.max_duration_min} min max.` : null,
    feeText(festival.fee),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <article
      aria-labelledby={`d-${festival.id}`}
      className="flex flex-col gap-4 border-2 border-ink bg-white p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 basis-64 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <StatusChip tone={dl.tone} icon={festival.deadline_status === 'passee' ? 'calendar' : 'clock'}>
              {dl.text}
            </StatusChip>
            <StatusChip tone={SHORTLIST_STATUS_TONES[item.status]} icon={SHORTLIST_STATUS_ICONS[item.status]}>
              {SHORTLIST_STATUS_LABELS[item.status]}
            </StatusChip>
          </div>
          <h3 id={`d-${festival.id}`} className="text-[20px] leading-tight">
            {festival.name}
          </h3>
          <p className="text-meta text-muted-on-light">{meta}</p>
          {festival.deadline_status !== 'ouverte' && festival.deadline_note ? (
            <p className="text-meta text-muted-on-light">{festival.deadline_note}</p>
          ) : null}
        </div>
        <PiecesProgress ready={countReady(pieces)} total={pieces.length} className="w-full sm:w-44" />
      </div>
      {pieces.length ? (
        <PiecesList pieces={pieces} compact busy={busy} onToggle={onTogglePiece} />
      ) : (
        <p className="text-meta text-muted-on-light">
          Le règlement ne liste pas de pièces précises : vérifie le formulaire sur le site officiel.
        </p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3 border-t-2 border-line-light pt-4">
        <div className="flex flex-wrap gap-2">
          <ButtonLink to={`/festival/${encodeURIComponent(festival.id)}`} variant="secondary" size="sm">
            Voir la fiche du festival
          </ButtonLink>
          <Button variant="ghost" size="sm" icon="trash" onClick={onRemove} disabled={busy}>
            Retirer
          </Button>
        </div>
        <Field label="Où j’en suis" className="w-full sm:w-72">
          <Select
            value={item.status}
            disabled={busy}
            onChange={(e) => onChange({ ...item, status: e.target.value as ShortlistStatus })}
          >
            {SHORTLIST_STATUSES.map((s) => (
              <option key={s} value={s}>
                {SHORTLIST_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </article>
  );
}

function DossiersBody({ project, passport }: { project: Project; passport: Passport | null | undefined }) {
  const { toast } = useToast();
  const shortlist = useShortlist(project);
  const ids = project.festival_shortlist.map((s) => s.festival_id);
  const festivals = useShortlistFestivals(ids);
  const ctx = useDossierContext(project, passport);

  const save = (p: Promise<unknown>) =>
    p.catch(() =>
      toast({ tone: 'bad', title: 'Modification non enregistrée', description: 'Réessaie dans un instant.' }),
    );

  return (
    <div className="flex flex-col gap-8">
      <KitHeader dossierCount={project.festival_shortlist.length} />
      {!ids.length ? (
        <EmptyState
          icon="doc"
          title="Pas encore de dossier"
          action={
            <ButtonLink to="/festival" iconRight="arrowRight">
              Parcourir le catalogue
            </ButtonLink>
          }
        >
          Choisis un festival dans le catalogue et clique sur « Préparer mon dossier » : ses pièces
          apparaîtront ici.
        </EmptyState>
      ) : (
        <QueryState
          query={festivals}
          loading={<LoadingBlock lines={10} label="Chargement des dossiers…" />}
          errorTitle="Les dossiers n’ont pas pu être chargés"
        >
          {({ festivals: list, missing }) => {
            const dossiers = list
              .slice()
              .sort(byDeadline)
              .map((f) => {
                const item = project.festival_shortlist.find((s) => s.festival_id === f.id)!;
                return { festival: f, item, label: shortName(f), pieces: dossierPieces(f, item, ctx) };
              });
            const shared = sharedPieces(dossiers);
            const multi = shared.filter((p) => p.usedBy.length > 1).length;
            const next = dossiers.find(
              (d) => d.festival.deadline_status === 'ouverte' && d.festival.deadline,
            );
            return (
              <>
                <section
                  aria-label="Résumé"
                  className="flex flex-wrap items-center gap-x-8 gap-y-3 border-2 border-ink bg-white p-4 md:p-5"
                >
                  <div>
                    <p className="font-display text-h3 font-bold">{project.title}</p>
                    <p className="text-meta text-muted-on-light">
                      {dossiers.length} dossier{dossiers.length > 1 ? 's' : ''} · {multi} pièce
                      {multi > 1 ? 's servent' : ' sert'} à plusieurs festivals
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 text-meta">
                    {next?.festival.deadline ? (
                      <span>
                        Prochaine date limite :{' '}
                        <strong>
                          {shortName(next.festival)}, {formatDate(next.festival.deadline)} (J-
                          {daysUntil(next.festival.deadline)})
                        </strong>
                      </span>
                    ) : (
                      <span>Aucune date limite ouverte dans tes dossiers.</span>
                    )}
                    <span>
                      Pièces prêtes :{' '}
                      <strong>
                        {shared.filter((p) => p.state === 'pret').length} sur {shared.length}
                      </strong>
                    </span>
                  </div>
                  <ButtonLink to="/festival" variant="secondary" icon="plus" className="lg:ml-auto">
                    Ajouter un festival
                  </ButtonLink>
                </section>

                {missing.length ? (
                  <p
                    role="status"
                    className="border-2 border-warn-fg/30 bg-warn-bg p-3 text-meta text-warn-fg"
                  >
                    {missing.length} festival{missing.length > 1 ? 's ne sont' : ' n’est'} plus dans le
                    catalogue.{' '}
                    <button
                      type="button"
                      className="min-h-11 font-semibold underline"
                      onClick={() => void save(Promise.all(missing.map((id) => shortlist.remove(id))))}
                    >
                      Retirer de mes dossiers
                    </button>
                  </p>
                ) : null}

                <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
                  <section aria-labelledby="par-festival" className="flex flex-col gap-4 lg:col-span-8">
                    <div>
                      <h2 id="par-festival" className="text-h3">
                        Par festival
                      </h2>
                      <p className="text-meta text-muted-on-light">
                        Triés par date limite. Ce qui bloque est en premier dans chaque dossier.
                      </p>
                    </div>
                    {dossiers.map((d) => (
                      <DossierCard
                        key={d.festival.id}
                        festival={d.festival}
                        item={d.item}
                        pieces={d.pieces}
                        busy={shortlist.pending}
                        onChange={(item) => void save(shortlist.replace(item))}
                        onTogglePiece={(r, done) => void save(shortlist.setPiece(d.festival, r, done))}
                        onRemove={() => void save(shortlist.remove(d.festival.id))}
                      />
                    ))}
                  </section>

                  <aside
                    aria-labelledby="mes-pieces"
                    className="flex flex-col gap-3 lg:sticky lg:top-24 lg:col-span-4"
                  >
                    <h2 id="mes-pieces" className="text-h3">
                      Mes pièces
                    </h2>
                    <p className="text-meta text-muted-on-light">
                      Tu prépares chaque pièce une seule fois. Elle remplit tous les dossiers qui la
                      demandent.
                    </p>
                    <ul className="flex flex-col gap-3">
                      {shared.map((p) => (
                        <li
                          key={p.key}
                          className="flex flex-col gap-1 border-2 border-line-light bg-white p-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <span className="font-semibold">{p.title}</span>
                            <StatusChip tone={STATE_TONES[p.state]}>{PIECE_STATE_LABELS[p.state]}</StatusChip>
                          </div>
                          <p className="text-meta text-muted-on-light">{p.detail}</p>
                          <p className="text-meta">
                            <span className="font-semibold">Pour : </span>
                            {p.usedBy.join(', ')}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </aside>
                </div>
              </>
            );
          }}
        </QueryState>
      )}
    </div>
  );
}

export default function Dossiers() {
  return (
    <WithProject>
      {(project, passport) => <DossiersBody project={project} passport={passport.data} />}
    </WithProject>
  );
}
