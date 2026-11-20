import { useState } from 'react';
import type { Member, Person } from '@/api/types';
import { AiDraftBadge, Button, ButtonLink, Field, Icon, Input, MoreInfo, Select } from '@/components/ui';
import { localId } from '../../lib/ids';
import type { DraftSetter, PlannerDraft } from './types';

const MANUAL = '__manuel__';

const CREW_ROLES = [
  'Réalisation',
  'Image',
  'Son',
  'Régie',
  'Assistanat réalisation',
  'Scripte',
  'Maquillage',
  'Costumes',
];

export function StepPeople({
  draft,
  setDraft,
  detected,
  members = [],
  onMembersChange,
}: {
  draft: PlannerDraft;
  setDraft: DraftSetter;
  detected: string[];
  /** Équipe enregistrée (page Équipe) : on y choisit l'acteur de chaque personnage. */
  members?: Member[];
  onMembersChange?: (members: Member[]) => void;
}) {
  const teamActors = members.filter((m) => m.role === 'acteur' && m.name.trim());
  // Personnages pour lesquels on a choisi « Saisir à la main »
  const [manual, setManual] = useState<Set<string>>(() => new Set());
  // Personnages : ceux des scènes + ceux déjà associés à un acteur
  const fromScenes = [...new Set(draft.scenes.flatMap((s) => s.characters))];
  const characters = [
    ...new Set([
      ...fromScenes,
      ...draft.people.filter((p) => p.kind === 'acteur' && p.character).map((p) => p.character!),
    ]),
  ];
  const actorFor = (c: string) => draft.people.find((p) => p.kind === 'acteur' && p.character === c);
  const crew = draft.people.filter((p) => p.kind === 'equipe');

  const upsertActor = (character: string, patch: Partial<Person>) =>
    setDraft((d) => {
      const existing = d.people.find((p) => p.kind === 'acteur' && p.character === character);
      if (existing)
        return { ...d, people: d.people.map((p) => (p.id === existing.id ? { ...p, ...patch } : p)) };
      return {
        ...d,
        people: [
          ...d.people,
          { id: localId('p'), kind: 'acteur', name: '', role: 'Acteur·rice', character, ...patch },
        ],
      };
    });
  const updatePerson = (id: string, patch: Partial<Person>) =>
    setDraft((d) => ({ ...d, people: d.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  /** Choix dans la liste : remplit nom et contact, et relie le personnage au membre de l'équipe. */
  const pickActor = (character: string, value: string) => {
    if (value === MANUAL) {
      setManual((m) => new Set(m).add(character));
      return;
    }
    setManual((m) => {
      const next = new Set(m);
      next.delete(character);
      return next;
    });
    const member = teamActors.find((m) => m.id === value);
    if (!member) {
      upsertActor(character, { name: '', contact: '' });
      return;
    }
    upsertActor(character, { name: member.name, contact: member.email || member.phone || '' });
    if (onMembersChange && !member.characters.includes(character))
      onMembersChange(
        members.map((m) =>
          m.id === member.id
            ? { ...m, characters: [...m.characters, character] }
            : { ...m, characters: m.characters.filter((c) => c !== character) },
        ),
      );
  };
  const addCrew = (role = '') =>
    setDraft((d) => ({ ...d, people: [...d.people, { id: localId('p'), kind: 'equipe', name: '', role }] }));

  return (
    <div className="flex flex-col gap-10">
      <div>
        <p className="flex items-center gap-2 text-muted-on-light">
          <Icon name="info" size={18} className="shrink-0" />
          Sert aux feuilles de service : qui vient, et quand.
        </p>
        <MoreInfo>Les disponibilités des acteurs ne sont pas prises en compte dans le planning.</MoreInfo>
      </div>

      <section aria-labelledby="acteurs-titre" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="acteurs-titre" className="text-h2">
            Personnages et acteurs
          </h2>
          <ButtonLink to="/equipe" variant="secondary" size="sm" icon="users">
            {teamActors.length ? 'Gérer l’équipe' : 'Ajouter des acteurs à l’équipe'}
          </ButtonLink>
        </div>
        {characters.length === 0 ? (
          <p className="text-muted-on-light">Aucun personnage dans tes scènes pour l’instant.</p>
        ) : (
          <ul className="flex flex-col divide-y-2 divide-line-light border-2 border-ink bg-white">
            {characters.map((c) => {
              const a = actorFor(c);
              const inScenes = draft.scenes.filter((s) => s.characters.includes(c)).length;
              // Membre choisi : celui qui joue déjà ce personnage, sinon celui qui porte le même nom
              const chosen =
                teamActors.find((m) => m.characters.includes(c)) ??
                (a?.name.trim() ? teamActors.find((m) => m.name.trim() === a.name.trim()) : undefined);
              const isManual = manual.has(c) || (!chosen && !!a?.name.trim());
              return (
                <li key={c} className="grid grid-cols-1 gap-3 p-4 md:grid-cols-12 md:items-end">
                  <div className="md:col-span-3">
                    <p className="font-display text-h3 font-bold">{c}</p>
                    <p className="text-meta text-muted-on-light">
                      {inScenes} scène{inScenes > 1 ? 's' : ''}
                    </p>
                    {a && detected.includes(a.id) && !a.name ? <AiDraftBadge className="mt-2" /> : null}
                  </div>
                  {teamActors.length ? (
                    <Field
                      label="Joué·e par"
                      className={chosen || isManual ? 'md:col-span-4' : 'md:col-span-9'}
                    >
                      <Select
                        value={isManual ? MANUAL : (chosen?.id ?? '')}
                        onChange={(e) => pickActor(c, e.target.value)}
                      >
                        <option value="">Choisir dans l’équipe…</option>
                        {teamActors.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                            {m.characters.length && !m.characters.includes(c)
                              ? ` (joue déjà ${m.characters.join(', ')})`
                              : ''}
                          </option>
                        ))}
                        <option value={MANUAL}>Autre : saisir à la main</option>
                      </Select>
                    </Field>
                  ) : null}
                  {chosen && !isManual ? (
                    <p className="text-meta text-muted-on-light md:col-span-5 md:pb-3">
                      {chosen.email || chosen.phone || 'Pas de contact dans l’équipe'}
                    </p>
                  ) : null}
                  {!teamActors.length || isManual ? (
                    <>
                      <Field
                        label={teamActors.length ? 'Nom' : 'Joué·e par'}
                        className={teamActors.length ? 'md:col-span-2' : 'md:col-span-5'}
                        error={!a?.name ? 'À compléter' : undefined}
                      >
                        <Input
                          value={a?.name ?? ''}
                          onChange={(e) => upsertActor(c, { name: e.target.value })}
                          placeholder="Nom de l’acteur ou de l’actrice"
                        />
                      </Field>
                      <Field
                        label="Contact"
                        optional
                        className={teamActors.length ? 'md:col-span-3' : 'md:col-span-4'}
                      >
                        <Input
                          value={a?.contact ?? ''}
                          onChange={(e) => upsertActor(c, { contact: e.target.value })}
                          placeholder="Téléphone ou email"
                        />
                      </Field>
                    </>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="equipe-titre" className="flex flex-col gap-4">
        <h2 id="equipe-titre" className="text-h2">
          Équipe
        </h2>
        {crew.length ? (
          <ul className="flex flex-col divide-y-2 divide-line-light border-2 border-ink bg-white">
            {crew.map((p) => (
              <li key={p.id} className="grid grid-cols-1 gap-3 p-4 md:grid-cols-12 md:items-end">
                <Field label="Rôle" className="md:col-span-3">
                  <Input value={p.role} onChange={(e) => updatePerson(p.id, { role: e.target.value })} />
                </Field>
                <Field label="Nom" className="md:col-span-4">
                  <Input value={p.name} onChange={(e) => updatePerson(p.id, { name: e.target.value })} />
                </Field>
                <Field label="Contact" optional className="md:col-span-4">
                  <Input
                    value={p.contact ?? ''}
                    onChange={(e) => updatePerson(p.id, { contact: e.target.value })}
                  />
                </Field>
                <Button
                  variant="ghost"
                  size="sm"
                  icon="trash"
                  className="md:col-span-1"
                  onClick={() => setDraft((d) => ({ ...d, people: d.people.filter((x) => x.id !== p.id) }))}
                >
                  <span className="sr-only">Retirer {p.role}</span>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-on-light">Personne dans l’équipe pour l’instant.</p>
        )}
        <div className="flex flex-wrap gap-2">
          {CREW_ROLES.filter((r) => !crew.some((p) => p.role === r)).map((r) => (
            <Button key={r} variant="secondary" size="sm" icon="plus" onClick={() => addCrew(r)}>
              {r}
            </Button>
          ))}
          <Button variant="ghost" size="sm" icon="plus" onClick={() => addCrew()}>
            Autre rôle
          </Button>
        </div>
      </section>
    </div>
  );
}
