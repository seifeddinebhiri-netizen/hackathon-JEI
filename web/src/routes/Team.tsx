/**
 * Équipe du film : acteurs (et leurs personnages) et techniciens, avec leurs coordonnées.
 * Sert aux convocations par e-mail. Enregistré dans le projet (champ `members`).
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { Member, MemberRole, Project } from '@/api/types';
import {
  Button,
  ButtonLink,
  Checkbox,
  EmptyState,
  ErrorState,
  Field,
  Icon,
  Input,
  LoadingBlock,
  PageHeader,
  Select,
  StatusChip,
  useToast,
} from '@/components/ui';
import {
  charactersWithoutActor,
  isValidEmail,
  membersFromPeople,
  projectCharacters,
} from '@/features/callsheets/lib';
import { localId } from '@/features/planner/lib/ids';
import { useCurrentProject, useUpdateProject } from '@/features/project/hooks/useProject';

const CREW_JOBS = [
  'Réalisation',
  'Assistanat réalisation',
  'Image',
  'Son',
  'Lumière',
  'Régie',
  'Scripte',
  'Maquillage',
  'Costumes',
  'Décors',
];
const OTHER = '__autre__';

function newMember(role: MemberRole, patch: Partial<Member> = {}): Member {
  return { id: localId('m'), name: '', email: '', role, characters: [], email_consent: false, ...patch };
}

const norm = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Champs communs : nom, e-mail, téléphone. */
function ContactFields({ member, onChange }: { member: Member; onChange: (p: Partial<Member>) => void }) {
  const emailError =
    member.email.trim() && !isValidEmail(member.email) ? 'Adresse e-mail non valide' : undefined;
  return (
    <>
      <Field label="Nom" className="md:col-span-4" error={member.name.trim() ? undefined : 'À compléter'}>
        <Input
          value={member.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Prénom et nom"
          autoComplete="off"
        />
      </Field>
      <Field
        label="E-mail"
        className="md:col-span-5"
        error={emailError}
        hint={member.email.trim() ? undefined : 'Nécessaire pour recevoir la convocation'}
      >
        <Input
          type="email"
          inputMode="email"
          value={member.email}
          onChange={(e) => onChange({ email: e.target.value })}
          placeholder="nom@exemple.com"
          autoComplete="off"
        />
      </Field>
      <Field label="Téléphone" optional className="md:col-span-3">
        <Input
          type="tel"
          inputMode="tel"
          value={member.phone ?? ''}
          onChange={(e) => onChange({ phone: e.target.value })}
          placeholder="+216 …"
          autoComplete="off"
        />
      </Field>
    </>
  );
}

function ConsentAndRemove({
  member,
  onChange,
  onRemove,
}: {
  member: Member;
  onChange: (p: Partial<Member>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-t-2 border-line-light pt-3">
      <Checkbox
        checked={member.email_consent}
        onCheckedChange={(email_consent) => onChange({ email_consent })}
        label="A accepté de recevoir ses convocations par e-mail"
        hint="Demande-lui son accord avant de cocher. Sans accord, rien ne lui sera envoyé."
      />
      <Button variant="ghost" size="sm" icon="trash" onClick={onRemove}>
        Retirer<span className="sr-only"> {member.name.trim() || 'ce membre'}</span>
      </Button>
    </div>
  );
}

/** Liste déroulante des personnages du découpage, + saisie libre si un personnage manque. */
function CharacterPicker({
  member,
  characters,
  playedBy,
  onChange,
}: {
  member: Member;
  characters: string[];
  playedBy: (c: string) => string | undefined;
  onChange: (p: Partial<Member>) => void;
}) {
  const [other, setOther] = useState<string | null>(null);
  const mine = new Set(member.characters.map(norm));
  const options = characters.filter((c) => !mine.has(norm(c)));
  const add = (c: string) => {
    const name = c.trim();
    if (name && !mine.has(norm(name))) onChange({ characters: [...member.characters, name] });
  };
  const label = member.name.trim() || 'cet acteur';

  return (
    <div className="flex flex-col gap-3">
      {member.characters.length ? (
        <ul className="flex flex-wrap gap-2" aria-label={`Personnages joués par ${label}`}>
          {member.characters.map((c) => (
            <li
              key={c}
              className="flex items-center gap-1 border-2 border-ink bg-gold-soft pl-3 font-semibold"
            >
              {c}
              <button
                type="button"
                className="grid size-11 place-items-center hover:bg-ink/10"
                onClick={() => onChange({ characters: member.characters.filter((x) => x !== c) })}
                aria-label={`Retirer le personnage ${c}`}
              >
                <Icon name="x" size={18} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field
          label={member.characters.length ? 'Ajouter un autre personnage' : 'Personnage joué'}
          error={member.characters.length ? undefined : 'Choisis au moins un personnage'}
        >
          <Select
            value=""
            onChange={(e) => {
              if (e.target.value === OTHER) setOther('');
              else if (e.target.value) add(e.target.value);
            }}
          >
            <option value="">
              {characters.length ? 'Choisir dans la liste…' : 'Aucun personnage détecté'}
            </option>
            {options.map((c) => {
              const by = playedBy(c);
              return (
                <option key={c} value={c}>
                  {by ? `${c} (déjà joué par ${by})` : c}
                </option>
              );
            })}
            <option value={OTHER}>Autre personnage (saisir le nom)…</option>
          </Select>
        </Field>
        {other !== null ? (
          <div className="flex items-end gap-2">
            <Field label="Nom du personnage" className="flex-1">
              <Input
                value={other}
                autoFocus
                onChange={(e) => setOther(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    add(other);
                    setOther(null);
                  }
                }}
              />
            </Field>
            <Button
              variant="secondary"
              onClick={() => {
                add(other);
                setOther(null);
              }}
              disabled={!other.trim()}
            >
              Ajouter
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ActorCard(props: {
  member: Member;
  characters: string[];
  playedBy: (c: string) => string | undefined;
  onChange: (p: Partial<Member>) => void;
  onRemove: () => void;
}) {
  const { member, onChange } = props;
  return (
    <li className="flex flex-col gap-4 border-2 border-ink bg-white p-4 md:p-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:items-start">
        <ContactFields member={member} onChange={onChange} />
      </div>
      <CharacterPicker
        member={member}
        characters={props.characters}
        playedBy={props.playedBy}
        onChange={onChange}
      />
      <ConsentAndRemove member={member} onChange={onChange} onRemove={props.onRemove} />
    </li>
  );
}

function CrewCard({
  member,
  onChange,
  onRemove,
}: {
  member: Member;
  onChange: (p: Partial<Member>) => void;
  onRemove: () => void;
}) {
  const listId = `postes-${member.id}`;
  return (
    <li className="flex flex-col gap-4 border-2 border-ink bg-white p-4 md:p-5">
      <Field label="Poste" className="md:max-w-sm" hint="Choisis dans la liste ou écris le poste.">
        <Input
          list={listId}
          value={member.job ?? ''}
          onChange={(e) => onChange({ job: e.target.value })}
          placeholder="Image, Son, Régie…"
        />
      </Field>
      <datalist id={listId}>
        {CREW_JOBS.map((j) => (
          <option key={j} value={j} />
        ))}
      </datalist>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:items-start">
        <ContactFields member={member} onChange={onChange} />
      </div>
      <p className="text-meta text-muted-on-light">Reçoit le planning complet du tournage.</p>
      <ConsentAndRemove member={member} onChange={onChange} onRemove={onRemove} />
    </li>
  );
}

function TeamEditor({ project }: { project: Project }) {
  const { toast } = useToast();
  const update = useUpdateProject(project.id);
  // État local jusqu'à « Enregistrer » ; remis à zéro quand le projet change (key du parent)
  const [members, setMembers] = useState<Member[]>(project.members ?? []);

  const characters = useMemo(() => projectCharacters(project), [project]);
  const actors = members.filter((m) => m.role === 'acteur');
  const crew = members.filter((m) => m.role === 'technicien');
  const missing = charactersWithoutActor(characters, members);
  const withoutEmail = members.filter((m) => !isValidEmail(m.email)).length;
  const dirty = JSON.stringify(members) !== JSON.stringify(project.members ?? []);
  const incomplete = members.some((m) => !m.name.trim() || (m.email.trim() && !isValidEmail(m.email)));

  const patch = (id: string, p: Partial<Member>) =>
    setMembers((ms) => ms.map((m) => (m.id === id ? { ...m, ...p } : m)));
  const remove = (id: string) => setMembers((ms) => ms.filter((m) => m.id !== id));
  const add = (m: Member) => setMembers((ms) => [...ms, m]);
  const playedBy = (memberId: string) => (c: string) =>
    actors
      .filter((a) => a.id !== memberId && a.characters.some((x) => norm(x) === norm(c)))
      .map((a) => a.name.trim() || 'un autre acteur')[0];

  const save = () =>
    update.mutate(
      { members },
      {
        onSuccess: () => toast({ tone: 'ok', title: 'Équipe enregistrée' }),
        onError: (e) => toast({ tone: 'bad', title: 'Enregistrement impossible', description: e.message }),
      },
    );

  return (
    <div className="flex flex-col gap-10 pb-24">
      <div className="flex flex-wrap gap-2" aria-label="Résumé de l’équipe">
        <StatusChip tone="neutral" icon="users">
          {actors.length} acteur{actors.length > 1 ? 's' : ''}
        </StatusChip>
        <StatusChip tone="neutral" icon="users">
          {crew.length} technicien{crew.length > 1 ? 's' : ''}
        </StatusChip>
        {characters.length ? (
          <StatusChip tone={missing.length ? 'warn' : 'ok'} icon={missing.length ? 'alert' : 'check'}>
            {missing.length
              ? `${missing.length} personnage${missing.length > 1 ? 's' : ''} sans acteur`
              : 'Chaque personnage a son acteur'}
          </StatusChip>
        ) : null}
        {members.length && withoutEmail ? (
          <StatusChip tone="warn" icon="mail">
            {withoutEmail} sans e-mail valide
          </StatusChip>
        ) : null}
      </div>

      {!members.length && project.people.some((p) => p.name.trim()) ? (
        <EmptyState
          icon="users"
          title="Tu as déjà saisi des personnes dans l’assistant"
          action={
            <Button
              variant="secondary"
              icon="copy"
              onClick={() => setMembers(membersFromPeople(project.people, () => localId('m')))}
            >
              Les reprendre ici
            </Button>
          }
        >
          Reprends-les, puis complète leurs e-mails. Leur accord pour les e-mails reste à cocher.
        </EmptyState>
      ) : null}

      <section aria-labelledby="acteurs" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="acteurs" className="text-h2">
            Acteurs et actrices
          </h2>
          <Button variant="secondary" icon="plus" onClick={() => add(newMember('acteur'))}>
            Ajouter un acteur
          </Button>
        </div>

        {missing.length ? (
          <div className="flex flex-col gap-3 border-2 border-ink bg-warn-bg p-4" role="status">
            <p className="flex items-center gap-2 font-semibold">
              <Icon name="alert" size={18} /> Personnages sans acteur
            </p>
            <ul className="flex flex-wrap gap-2">
              {missing.map((c) => (
                <li key={c}>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="plus"
                    onClick={() => add(newMember('acteur', { characters: [c] }))}
                  >
                    Acteur pour {c}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!characters.length ? (
          <p className="text-muted-on-light">
            Aucun personnage détecté pour l’instant.{' '}
            <Link to="/planner/projet?etape=2" className="font-semibold underline">
              Découpe ton scénario
            </Link>{' '}
            pour les retrouver dans la liste, ou saisis-les à la main.
          </p>
        ) : null}

        {actors.length ? (
          <ul className="flex flex-col gap-4">
            {actors.map((m) => (
              <ActorCard
                key={m.id}
                member={m}
                characters={characters}
                playedBy={playedBy(m.id)}
                onChange={(p) => patch(m.id, p)}
                onRemove={() => remove(m.id)}
              />
            ))}
          </ul>
        ) : (
          <p className="text-muted-on-light">Aucun acteur pour l’instant.</p>
        )}
      </section>

      <section aria-labelledby="techniciens" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="techniciens" className="text-h2">
            Techniciens
          </h2>
          <Button variant="secondary" icon="plus" onClick={() => add(newMember('technicien'))}>
            Ajouter un technicien
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {CREW_JOBS.filter((j) => !crew.some((m) => m.job === j)).map((j) => (
            <Button
              key={j}
              variant="ghost"
              size="sm"
              icon="plus"
              onClick={() => add(newMember('technicien', { job: j }))}
            >
              {j}
            </Button>
          ))}
        </div>
        {crew.length ? (
          <ul className="flex flex-col gap-4">
            {crew.map((m) => (
              <CrewCard
                key={m.id}
                member={m}
                onChange={(p) => patch(m.id, p)}
                onRemove={() => remove(m.id)}
              />
            ))}
          </ul>
        ) : (
          <p className="text-muted-on-light">Aucun technicien pour l’instant.</p>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-16 z-30 border-t-2 border-ink bg-paper md:bottom-0">
        <div className="container-pp flex min-h-16 flex-wrap items-center gap-4 py-2">
          <Button icon="check" onClick={save} loading={update.isPending} disabled={!dirty || incomplete}>
            Enregistrer l’équipe
          </Button>
          {incomplete ? (
            <p className="text-meta font-semibold text-bad-fg">
              Complète les noms et corrige les e-mails pour enregistrer.
            </p>
          ) : dirty ? (
            <p className="text-meta text-muted-on-light">Modifications non enregistrées.</p>
          ) : members.length ? (
            <p className="flex items-center gap-1.5 text-meta text-ok-fg">
              <Icon name="check" size={16} /> Tout est enregistré
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function Team() {
  const project = useCurrentProject();
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Équipe"
        title="L’équipe du film"
        lead="Acteurs, techniciens et leurs coordonnées pour les convocations."
        actions={
          <ButtonLink to="/planner/convocations" variant="secondary" icon="mail">
            Préparer les convocations
          </ButtonLink>
        }
      />
      {project.isPending ? (
        <LoadingBlock lines={6} label="Chargement de l’équipe…" />
      ) : project.isError ? (
        <ErrorState error={project.error} onRetry={() => void project.refetch()} />
      ) : (
        <TeamEditor key={project.data.id} project={project.data} />
      )}
    </div>
  );
}
