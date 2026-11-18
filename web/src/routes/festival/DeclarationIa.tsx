import { useState } from 'react';
import { useLocation, useParams } from 'react-router';
import type { Festival, Passport, Project } from '@/api/types';
import {
  AiDraftBadge,
  Button,
  ButtonLink,
  ErrorState,
  Field,
  FileDrop,
  Icon,
  Input,
  LoadingBlock,
  QueryState,
  StatusChip,
  useToast,
} from '@/components/ui';
import { Breadcrumb, WithProject } from '@/features/festival/components/Kit';
import { shortName } from '@/features/festival/lib/kit';
import { useFestival, useShortlist, useShortlistFestivals } from '@/features/festival/hooks/useFestivals';
import {
  AI_CHOICE_LABELS,
  choiceHint,
  deptLabel,
  proposeChoice,
  readChoice,
  whyChoice,
  writeChoice,
  type AiChoice,
} from '@/features/festival/lib/aiDeclaration';
import { newShortlistItem, setRequirementDone } from '@/features/festival/lib/dossier';
import { passportWithReturn } from '@/features/festival/lib/retour';
import { cn } from '@/lib/cn';

const CHOICES = Object.keys(AI_CHOICE_LABELS) as AiChoice[];
const DECLARATION = { kind: 'declaration_ia', detail: 'Déclaration d’usage de l’IA' } as const;

function PassportSummary({ passport, returnTo }: { passport: Passport; returnTo: string }) {
  const used = passport.declarations.filter((d) => d.used_ai).length;
  return (
    <section aria-labelledby="passeport" className="flex flex-col gap-3 border-2 border-ink bg-white p-5">
      <p id="passeport" className="eyebrow">
        Ton Passeport IA
      </p>
      <p className="font-display text-h3 font-bold">
        {passport.film_title} · {used} département{used > 1 ? 's' : ''} sur {passport.declarations.length}
      </p>
      <ul className="flex flex-col">
        {passport.declarations.map((d) => (
          <li
            key={d.department}
            className="flex min-h-11 items-center justify-between gap-3 border-b border-line-light"
          >
            <span>{deptLabel(d.department)}</span>
            <StatusChip tone={d.used_ai ? 'warn' : 'neutral'} icon={d.used_ai ? 'sparkle' : 'minus'}>
              {d.used_ai ? 'IA déclarée' : 'Aucune IA'}
            </StatusChip>
          </li>
        ))}
      </ul>
      <ButtonLink
        to={passportWithReturn(returnTo)}
        variant="secondary"
        size="sm"
        icon="edit"
        className="self-start"
      >
        Modifier dans l’étape 3 · Déclarer
      </ButtonLink>
    </section>
  );
}

function Proposal({
  festival,
  project,
  passport,
}: {
  festival: Festival;
  project: Project;
  passport: Passport;
}) {
  const { toast } = useToast();
  const shortlist = useShortlist(project);
  const item = project.festival_shortlist.find((s) => s.festival_id === festival.id);
  const req = festival.requirements.find((r) => r.kind === 'declaration_ia');
  const proposed = proposeChoice(passport);
  const [saved, setSaved] = useState<AiChoice | null>(() => readChoice(project.id, festival.id));
  const [choice, setChoice] = useState<AiChoice>(saved ?? proposed);
  const validated =
    saved === choice && !!item?.checklist.find((c) => c.requirement.kind === 'declaration_ia')?.done;
  const name = shortName(festival);

  const persist = (done: boolean) => {
    const base = item ?? newShortlistItem(festival);
    const next = setRequirementDone(base, req ?? DECLARATION, done);
    const p = item ? shortlist.replace(next) : shortlist.add(next);
    return p
      .then(() => {
        writeChoice(project.id, festival.id, done ? choice : null);
        setSaved(done ? choice : null);
      })
      .catch(() =>
        toast({ tone: 'bad', title: 'Réponse non enregistrée', description: 'Réessaie dans un instant.' }),
      );
  };

  return (
    <section
      aria-labelledby="question"
      className="flex flex-col gap-4 border-2 border-ink bg-white p-5 shadow-hard"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="question" className="text-h3">
          La question de {name}
        </h2>
        <AiDraftBadge validated={validated} />
      </div>
      <p className="text-meta text-muted-on-light">
        {req
          ? `Le festival demande : ${req.detail}.`
          : 'Le règlement ne détaille pas la forme de la déclaration.'}{' '}
        La case est proposée à partir de ton Passeport : vérifie-la avant de la reporter sur le formulaire
        officiel.
      </p>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-meta font-semibold">Usage de l’IA</legend>
        {CHOICES.map((c) => (
          <label
            key={c}
            className={cn(
              'flex min-h-11 cursor-pointer items-start gap-3 bg-white p-3 has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-gold',
              choice === c ? 'border-[3px] border-ink' : 'border-2 border-line-light',
            )}
          >
            <input
              type="radio"
              name="declaration"
              value={c}
              checked={choice === c}
              onChange={() => setChoice(c)}
              className="mt-1 size-5 accent-ink"
            />
            <span className="flex flex-col">
              <span className="font-semibold">
                {AI_CHOICE_LABELS[c]}
                {c === proposed ? (
                  <span className="eyebrow ml-2 text-muted-on-light">Proposition</span>
                ) : null}
              </span>
              <span className="text-meta text-muted-on-light">{choiceHint(c, passport)}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <p className="text-meta">
        <strong>Pourquoi cette case : </strong>
        {whyChoice(passport)}
      </p>
      <Button
        variant={validated ? 'secondary' : 'primary'}
        icon={validated ? undefined : 'check'}
        className="whitespace-normal! text-left self-start"
        loading={shortlist.pending}
        onClick={() => void persist(!validated)}
      >
        {validated ? 'Validé par toi · annuler' : `Valider ma réponse pour ${name}`}
      </Button>
    </section>
  );
}

function OtherDossiers({ project, festival }: { project: Project; festival: Festival }) {
  const ids = project.festival_shortlist.map((s) => s.festival_id).filter((id) => id !== festival.id);
  const others = useShortlistFestivals(ids);
  if (!ids.length) return null;
  return (
    <section aria-labelledby="autres" className="flex flex-col gap-3 border-2 border-line-light bg-white p-5">
      <h2 id="autres" className="text-h3">
        Et pour tes autres dossiers
      </h2>
      <p className="text-meta text-muted-on-light">
        La même déclaration, dans la forme que chaque festival demande.
      </p>
      <QueryState query={others} loading={<LoadingBlock lines={2} />}>
        {({ festivals }) => (
          <ul className="flex flex-col">
            {festivals.map((f) => {
              const asks = f.requirements.some((r) => r.kind === 'declaration_ia');
              return (
                <li
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-line-light py-2 last:border-b-0"
                >
                  <span className="flex flex-col">
                    <strong>{shortName(f)}</strong>
                    <span className="text-meta text-muted-on-light">
                      {asks
                        ? f.requirements.find((r) => r.kind === 'declaration_ia')!.detail
                        : 'Le règlement ne demande rien sur l’IA.'}
                    </span>
                  </span>
                  {asks ? (
                    <ButtonLink
                      to={`/festival/dossiers/${encodeURIComponent(f.id)}/declaration-ia`}
                      size="sm"
                      variant="secondary"
                    >
                      Voir la proposition
                    </ButtonLink>
                  ) : (
                    <StatusChip tone="neutral" icon="minus">
                      Rien à faire
                    </StatusChip>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </QueryState>
    </section>
  );
}

function Todo({
  festival,
  returnTo,
  onImport,
}: {
  festival: Festival;
  returnTo: string;
  onImport: () => void;
}) {
  return (
    <section className="flex max-w-3xl flex-col gap-4 border-2 border-ink bg-white p-6 shadow-hard">
      <h2 className="text-h3">Tu n’as pas encore rempli ton Passeport IA</h2>
      <p>
        {shortName(festival)}{' '}
        {festival.ai_policy === 'non_precisee'
          ? 'ne précise rien sur l’IA, mais une déclaration claire rassure.'
          : 'demande une déclaration.'}{' '}
        Le Passeport prend environ 5 minutes : 8 départements (scénario, image, son, montage…), et pour
        chacun, l’outil d’IA utilisé ou « aucun ».
      </p>
      <div className="flex flex-wrap gap-3">
        <ButtonLink to={passportWithReturn(returnTo)} iconRight="arrowRight">
          Déclarer maintenant
        </ButtonLink>
        <Button variant="secondary" onClick={onImport}>
          J’ai déjà une déclaration ailleurs
        </Button>
      </div>
      <p className="text-meta text-muted-on-light">
        Quand tu as fini, encadré te ramène ici, avec la case de {shortName(festival)} déjà proposée.
      </p>
    </section>
  );
}

function Import({ returnTo, onBack }: { returnTo: string; onBack: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState('');
  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-start gap-2 border-2 border-warn-fg/30 bg-warn-bg p-3 text-meta text-warn-fg">
        <Icon name="info" size={16} className="mt-0.5 shrink-0" />
        Maquette fonctionnelle : la lecture des Content Credentials (C2PA) n’est pas encore branchée. Le
        résultat ci-dessous est un exemple, rien n’est lu dans ton fichier.
      </p>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <section aria-labelledby="importer" className="flex flex-col gap-4 border-2 border-ink bg-white p-5">
          <h2 id="importer" className="text-h3">
            Importer une déclaration existante
          </h2>
          <p className="text-meta text-muted-on-light">
            Deux façons, au choix. Tu confirmes tout avant que ça compte.
          </p>
          <FileDrop
            accept={['.mp4', '.mov', '.jpg', '.jpeg', '.png', '.pdf']}
            file={file}
            onFile={setFile}
            label="Dépose ton fichier final"
            hint="Si ton logiciel a ajouté des Content Credentials (C2PA), la liste des outils pourra être lue."
          />
          <Field label="Ou colle un lien de Passeport encadré" optional>
            <Input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://…/verifier/…"
            />
          </Field>
        </section>
        <section
          aria-labelledby="exemple"
          className="flex flex-col gap-3 border-2 border-dashed border-ink bg-white p-5"
        >
          <p id="exemple" className="eyebrow">
            Exemple de résultat
          </p>
          <p className="font-semibold">2 outils trouvés dans le fichier</p>
          <ul className="flex flex-col gap-2 text-meta">
            <li>Montage · nettoyage du son par IA → département Son</li>
            <li>Étalonnage · aucune IA déclarée → département Image</li>
          </ul>
          <p className="text-meta text-muted-on-light">
            Un fichier sans Content Credentials ne prouve rien : dans ce cas, tu remplis le Passeport
            toi-même.
          </p>
          <ButtonLink
            to={passportWithReturn(returnTo)}
            iconRight="arrowRight"
            className="self-start whitespace-normal! text-left"
          >
            Confirmer et compléter mon Passeport
          </ButtonLink>
        </section>
      </div>
      <Button variant="ghost" icon="arrowLeft" onClick={onBack} className="self-start">
        Retour
      </Button>
    </div>
  );
}

function Page({
  project,
  passport,
}: {
  project: Project;
  passport: { data: Passport | null | undefined; isError: boolean };
}) {
  const { festivalId } = useParams();
  const { pathname } = useLocation();
  const festival = useFestival(festivalId);
  const [importing, setImporting] = useState(false);
  return (
    <QueryState
      query={festival}
      loading={<LoadingBlock lines={8} label="Chargement du dossier…" />}
      errorTitle="Ce dossier n’a pas pu être chargé"
    >
      {(f) => (
        <div className="flex flex-col gap-6">
          <Breadcrumb
            items={[
              { label: 'Mes dossiers', to: '/festival/dossiers' },
              { label: shortName(f), to: `/festival/${encodeURIComponent(f.id)}` },
              { label: 'Déclaration IA' },
            ]}
          />
          <div className="max-w-3xl">
            <h1 className="text-[36px] leading-none md:text-page">Déclaration IA pour {shortName(f)}</h1>
            <p className="mt-4 text-lead text-muted-on-light">
              encadré part de ton Passeport IA pour te proposer la bonne réponse. Tu la reportes toi-même sur
              le formulaire du festival.
            </p>
          </div>
          {passport.isError ? (
            <ErrorState
              title="Passeport IA indisponible"
              error="Ton Passeport n’a pas pu être chargé. Réessaie dans un instant."
            />
          ) : passport.data === undefined ? (
            <LoadingBlock lines={6} label="Chargement du Passeport…" />
          ) : passport.data === null ? (
            importing ? (
              <Import returnTo={pathname} onBack={() => setImporting(false)} />
            ) : (
              <Todo festival={f} returnTo={pathname} onImport={() => setImporting(true)} />
            )
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
              <div className="lg:col-span-5">
                <PassportSummary passport={passport.data} returnTo={pathname} />
              </div>
              <div className="flex flex-col gap-6 lg:col-span-7">
                <Proposal festival={f} project={project} passport={passport.data} />
                <OtherDossiers project={project} festival={f} />
              </div>
            </div>
          )}
        </div>
      )}
    </QueryState>
  );
}

export default function DeclarationIa() {
  return <WithProject>{(project, passport) => <Page project={project} passport={passport} />}</WithProject>;
}
