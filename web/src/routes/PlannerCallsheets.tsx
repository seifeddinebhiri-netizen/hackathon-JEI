/**
 * Convocations : le réalisateur relit chaque e-mail, puis envoie. Jamais d'envoi automatique.
 * Chaque personne ne reçoit que ce qui la concerne (le serveur filtre les scènes).
 */
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '@/api';
import type {
  CallsheetDraft,
  CallsheetPreview,
  CallsheetSendResult,
  CallsheetSendStatus,
  Project,
} from '@/api/types';
import {
  Button,
  ButtonLink,
  Checkbox,
  Dialog,
  DialogClose,
  DialogContent,
  EmptyState,
  ErrorState,
  Field,
  Icon,
  Input,
  LoadingBlock,
  PageHeader,
  StatusChip,
  TextArea,
  type ChipTone,
} from '@/components/ui';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { buildCallsheetInput, downloadIcs, isValidEmail, mailtoHref } from '@/features/callsheets/lib';
import { useCurrentProject } from '@/features/project/hooks/useProject';
import { formatDayLong } from '@/lib/format';

type Edit = { subject: string; message: string; includeText: boolean; excluded: boolean };

const STATUS: Record<CallsheetSendStatus, { label: string; tone: ChipTone }> = {
  envoye: { label: 'Envoyée', tone: 'ok' },
  essai: { label: 'Essai : non envoyée', tone: 'gold' },
  ignore: { label: 'Pas envoyée', tone: 'warn' },
  erreur: { label: 'Erreur', tone: 'bad' },
};

const fullText = (d: CallsheetDraft, e: Edit) => `${e.message.trim()}\n\n${d.schedule_text}`;
const people = (n: number) => `${n} personne${n > 1 ? 's' : ''}`;

function DraftCard({
  draft,
  edit,
  onEdit,
  onToggleText,
  togglingText,
  hasSceneText,
}: {
  draft: CallsheetDraft;
  edit: Edit;
  onEdit: (patch: Partial<Edit>) => void;
  onToggleText: (v: boolean) => void;
  togglingText: boolean;
  hasSceneText: boolean;
}) {
  const days = [...new Set(draft.scenes.map((s) => s.date))];
  return (
    <li
      className={`flex flex-col gap-4 border-2 border-ink p-4 md:p-6 ${edit.excluded ? 'bg-paper opacity-80' : 'bg-white'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-h3 font-bold">{draft.name}</h2>
          <p className="text-muted-on-light">
            {draft.role === 'acteur' ? 'Acteur ou actrice' : 'Technicien·ne'} ·{' '}
            {draft.to || 'pas d’adresse e-mail'}
          </p>
        </div>
        {draft.blocked_reason ? (
          <StatusChip tone="warn" icon="alert">
            {draft.blocked_reason} : ne sera pas envoyée
          </StatusChip>
        ) : null}
      </div>

      <div>
        <p className="font-semibold">
          {draft.scenes.length} scène{draft.scenes.length > 1 ? 's' : ''}, {days.length} jour
          {days.length > 1 ? 's' : ''} de tournage
        </p>
        <ul className="mt-1 text-meta text-muted-on-light">
          {draft.scenes.map((s) => (
            <li key={`${s.date}-${s.number}`}>
              Scène {s.number}
              {s.title ? ` : ${s.title}` : ''} · {formatDayLong(s.date)} · {s.location_name}
            </li>
          ))}
        </ul>
      </div>

      <Field label="Objet">
        <Input value={edit.subject} maxLength={200} onChange={(e) => onEdit({ subject: e.target.value })} />
      </Field>
      <Field label="Message" hint="Le planning de la personne est ajouté sous ton message.">
        <TextArea rows={7} value={edit.message} onChange={(e) => onEdit({ message: e.target.value })} />
      </Field>

      <details className="border-2 border-line-light bg-paper">
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 font-semibold">
          <Icon name="eye" size={18} /> Aperçu de l’e-mail
        </summary>
        <pre className="max-h-96 overflow-auto px-3 pb-3 font-body text-meta whitespace-pre-wrap">
          {fullText(draft, edit)}
        </pre>
      </details>

      <div className="flex flex-col gap-1">
        <Checkbox
          checked={edit.includeText}
          disabled={togglingText || !hasSceneText}
          onCheckedChange={onToggleText}
          label="Joindre le texte de ses scènes"
          hint={
            hasSceneText
              ? 'Seulement ses scènes, jamais le scénario complet.'
              : 'Pas de texte de scène disponible dans ce projet.'
          }
        />
        <Checkbox
          checked={edit.excluded}
          onCheckedChange={(excluded) => onEdit({ excluded })}
          label={`Ne pas envoyer à ${draft.name}`}
        />
      </div>

      <div className="flex flex-wrap gap-3 border-t-2 border-line-light pt-4">
        <a
          href={mailtoHref(draft.to, edit.subject, fullText(draft, edit))}
          className="inline-flex min-h-11 items-center gap-2 border-2 border-ink bg-white px-3 text-meta font-semibold underline-offset-4 hover:underline"
        >
          <Icon name="mail" size={18} /> Ouvrir dans ma messagerie
        </a>
        <Button
          variant="secondary"
          size="sm"
          icon="download"
          onClick={() => downloadIcs(`convocation-${draft.name.replace(/\s+/g, '-')}.ics`, draft.ics)}
        >
          Télécharger l’agenda (.ics)
        </Button>
        <ButtonLink
          to={`/planner/convocations/fiche/${encodeURIComponent(draft.member_id)}?pdf=1`}
          target="_blank"
          rel="noopener"
          variant="secondary"
          size="sm"
          icon="download"
          aria-label={`Télécharger en PDF la convocation de ${draft.name} (nouvel onglet)`}
        >
          Télécharger en PDF
        </ButtonLink>
      </div>
    </li>
  );
}

function Results({ result }: { result: CallsheetSendResult }) {
  return (
    <section aria-labelledby="resultats" className="flex flex-col gap-4">
      {result.dry_run ? (
        <div role="status" className="flex items-start gap-3 border-2 border-ink bg-gold-soft p-4">
          <Icon name="info" className="mt-0.5 shrink-0" />
          <p className="font-semibold">Mode essai : aucun e-mail n’a été envoyé.</p>
        </div>
      ) : null}
      <h2 id="resultats" className="text-h2">
        Résultat de l’envoi
      </h2>
      <ul className="flex flex-col divide-y-2 divide-line-light border-2 border-ink bg-white">
        {result.results.map((r) => (
          <li key={r.member_id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-semibold">{r.name || r.member_id}</p>
              <p className="text-meta text-muted-on-light">
                {r.to || 'pas d’adresse'}
                {r.reason ? ` · ${r.reason}` : ''}
              </p>
            </div>
            <StatusChip tone={STATUS[r.status].tone}>{STATUS[r.status].label}</StatusChip>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Review({ project }: { project: Project }) {
  const { user } = useAuth();
  const [director, setDirector] = useState(user?.name ?? '');
  const [replyTo, setReplyTo] = useState(user?.email && isValidEmail(user.email) ? user.email : '');
  const [preview, setPreview] = useState<CallsheetPreview | null>(null);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [toggling, setToggling] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const inputFor = (withTextFor: string[]) =>
    buildCallsheetInput(project, { directorName: director.trim(), replyTo: replyTo.trim(), withTextFor });

  const prepare = useMutation({
    mutationFn: () => api.previewCallsheets(inputFor([])),
    onSuccess: (res) => {
      setPreview(res);
      setEdits(
        Object.fromEntries(
          res.drafts.map((d) => [
            d.member_id,
            { subject: d.subject, message: d.message, includeText: false, excluded: false },
          ]),
        ),
      );
      send.reset();
    },
  });

  const withTextFor = Object.entries(edits)
    .filter(([, e]) => e.includeText && !e.excluded)
    .map(([id]) => id);

  const toggleText = async (memberId: string, on: boolean) => {
    setToggling(memberId);
    try {
      // Nouveau brouillon pour cette personne seulement : le texte de ses scènes, rien d'autre
      const member = (project.members ?? []).filter((m) => m.id === memberId);
      const res = await api.previewCallsheets({
        ...inputFor(on ? [memberId] : []),
        members: member,
      });
      const fresh = res.drafts[0];
      if (fresh)
        setPreview((p) =>
          p ? { ...p, drafts: p.drafts.map((d) => (d.member_id === memberId ? fresh : d)) } : p,
        );
      setEdits((es) => ({ ...es, [memberId]: { ...es[memberId], includeText: on } }));
    } finally {
      setToggling(null);
    }
  };

  const send = useMutation({
    mutationFn: () => {
      const drafts = (preview?.drafts ?? [])
        .filter((d) => !edits[d.member_id]?.excluded)
        .map((d) => {
          const e = edits[d.member_id];
          return {
            member_id: d.member_id,
            subject: e.subject.trim(),
            message: e.message,
            include_scene_text: e.includeText,
          };
        });
      return api.sendCallsheets({ ...inputFor(withTextFor), drafts });
    },
    onSuccess: () => setConfirmOpen(false),
  });

  const members = project.members ?? [];
  const drafts = preview?.drafts ?? [];
  const toSend = drafts.filter((d) => !edits[d.member_id]?.excluded && !d.blocked_reason);
  const blocked = drafts.filter((d) => !edits[d.member_id]?.excluded && d.blocked_reason);
  const emptySubject = toSend.some((d) => !edits[d.member_id]?.subject.trim());
  const hasSceneText = project.scenes.some((s) => !!s.excerpt);

  if (!project.schedule?.days.length)
    return (
      <EmptyState
        icon="calendar"
        title="Pas encore de planning"
        action={
          <ButtonLink to="/planner/calendrier" icon="calendar">
            Aller au calendrier
          </ButtonLink>
        }
      >
        Les convocations se préparent à partir des jours de tournage planifiés.
      </EmptyState>
    );
  if (!members.length)
    return (
      <EmptyState
        icon="users"
        title="Ajoute d’abord ton équipe"
        action={
          <ButtonLink to="/equipe" icon="users">
            Compléter l’équipe
          </ButtonLink>
        }
      >
        Indique qui joue quel personnage et l’e-mail de chaque personne.
      </EmptyState>
    );

  return (
    <div className="flex flex-col gap-8">
      <section className="grid grid-cols-1 gap-4 border-2 border-ink bg-white p-4 md:grid-cols-2 md:p-6">
        <Field label="Ton nom" hint="Signe les e-mails.">
          <Input value={director} onChange={(e) => setDirector(e.target.value)} autoComplete="name" />
        </Field>
        <Field
          label="E-mail pour les réponses"
          hint="Les réponses des membres arrivent ici."
          error={replyTo.trim() && !isValidEmail(replyTo) ? 'Adresse e-mail non valide' : undefined}
        >
          <Input
            type="email"
            value={replyTo}
            onChange={(e) => setReplyTo(e.target.value)}
            autoComplete="email"
          />
        </Field>
        <div className="md:col-span-2">
          <Button icon="doc" onClick={() => prepare.mutate()} loading={prepare.isPending}>
            {preview ? 'Préparer à nouveau (efface les modifications)' : 'Préparer les brouillons'}
          </Button>
        </div>
      </section>

      {prepare.isError ? <ErrorState error={prepare.error} onRetry={() => prepare.mutate()} /> : null}

      {send.data ? <Results result={send.data} /> : null}

      {preview ? (
        <>
          {!preview.email_configured ? (
            <div role="status" className="flex items-start gap-3 border-2 border-ink bg-gold-soft p-4">
              <Icon name="info" className="mt-0.5 shrink-0" />
              <p>
                <strong>Mode essai :</strong> le serveur n’a pas de clé d’envoi. « Envoyer » montrera ce qui
                partirait, sans envoyer d’e-mail. Tu peux utiliser « Ouvrir dans ma messagerie ».
              </p>
            </div>
          ) : null}

          {preview.not_concerned.length ? (
            <div className="border-2 border-line-light bg-paper p-4">
              <p className="font-semibold">Pas de convocation pour :</p>
              <ul className="text-meta">
                {preview.not_concerned.map((n) => (
                  <li key={n.member_id}>
                    {n.name} : {n.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <ul className="flex flex-col gap-6">
            {drafts.map((d) => (
              <DraftCard
                key={d.member_id}
                draft={d}
                edit={edits[d.member_id]}
                onEdit={(p) => setEdits((es) => ({ ...es, [d.member_id]: { ...es[d.member_id], ...p } }))}
                onToggleText={(v) => void toggleText(d.member_id, v)}
                togglingText={toggling === d.member_id}
                hasSceneText={hasSceneText}
              />
            ))}
          </ul>

          <div className="sticky bottom-0 flex flex-wrap items-center gap-4 border-2 border-ink bg-paper p-4">
            <div className="flex flex-col gap-1">
              <p className="font-semibold">
                {toSend.length
                  ? `${people(toSend.length)} recevront leur convocation`
                  : 'Personne à convoquer'}
              </p>
              {/* Pourquoi rien ne part : dit tout de suite quoi corriger, et où */}
              {!toSend.length ? (
                <p className="text-meta">
                  {blocked.length
                    ? blocked.map((d) => `${d.name} : ${d.blocked_reason}`).join(' · ')
                    : drafts.length
                      ? 'Tous les membres sont retirés de l’envoi.'
                      : 'Aucun membre n’a de scène planifiée (voir la liste ci-dessus).'}{' '}
                  <Link to="/equipe" className="font-semibold underline underline-offset-4">
                    Corriger dans Équipe
                  </Link>
                </p>
              ) : null}
            </div>
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <Button
                icon="send"
                disabled={!toSend.length || emptySubject}
                onClick={() => setConfirmOpen(true)}
              >
                Envoyer
              </Button>
              <DialogContent
                title="Envoyer les convocations ?"
                description={
                  preview.email_configured
                    ? 'Les e-mails partent tout de suite. Tu ne pourras pas les annuler.'
                    : 'Mode essai : aucun e-mail ne partira.'
                }
              >
                <p className="font-semibold">
                  {people(toSend.length)} {toSend.length > 1 ? 'vont' : 'va'} recevoir leur convocation :
                </p>
                <ul className="mt-2 list-disc pl-6">
                  {toSend.map((d) => (
                    <li key={d.member_id}>{d.name}</li>
                  ))}
                </ul>
                {blocked.length ? (
                  <p className="mt-3 text-meta text-muted-on-light">
                    Pas d’envoi pour {blocked.map((d) => `${d.name} (${d.blocked_reason})`).join(', ')}.
                  </p>
                ) : null}
                {send.isError ? (
                  <p className="mt-3 font-semibold text-bad-fg" role="alert">
                    {send.error.message}
                  </p>
                ) : null}
                <div className="mt-6 flex flex-wrap justify-end gap-3">
                  <DialogClose asChild>
                    <Button variant="ghost">Annuler</Button>
                  </DialogClose>
                  <Button icon="send" loading={send.isPending} onClick={() => send.mutate()}>
                    Oui, envoyer
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            {emptySubject ? (
              <p className="text-meta text-bad-fg">Chaque e-mail doit avoir un objet.</p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function PlannerCallsheets() {
  const project = useCurrentProject();
  return (
    <div className="flex flex-col gap-8">
      {/* Retour à l'écran final de la génération (calendrier du planning) */}
      <Link
        to="/planner/calendrier"
        className="no-print -mb-4 inline-flex min-h-11 items-center gap-2 self-start font-semibold underline-offset-4 hover:underline"
      >
        <Icon name="arrowLeft" size={18} />
        Retour au planning
      </Link>
      <PageHeader
        eyebrow="Planifier · Convocations"
        title="Convocations"
        lead="Chacun reçoit seulement ses scènes. Relis, puis envoie."
        actions={
          <ButtonLink to="/equipe" variant="secondary" icon="users">
            Équipe
          </ButtonLink>
        }
      />
      {project.isPending ? (
        <LoadingBlock lines={6} label="Chargement du planning…" />
      ) : project.isError ? (
        <ErrorState error={project.error} onRetry={() => void project.refetch()} />
      ) : (
        <Review project={project.data} />
      )}
    </div>
  );
}
