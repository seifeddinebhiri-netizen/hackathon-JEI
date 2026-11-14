import type { Person } from '@/api/types';
import { AiDraftBadge, Button, Field, Icon, Input } from '@/components/ui';
import { localId } from '../../lib/ids';
import type { DraftSetter, PlannerDraft } from './types';

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
}: {
  draft: PlannerDraft;
  setDraft: DraftSetter;
  detected: string[];
}) {
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
  const addCrew = (role = '') =>
    setDraft((d) => ({ ...d, people: [...d.people, { id: localId('p'), kind: 'equipe', name: '', role }] }));

  return (
    <div className="flex flex-col gap-10">
      <p className="flex max-w-prose items-start gap-2 border-l-4 border-gold pl-3 text-muted-on-light">
        <Icon name="info" size={18} className="mt-0.5 shrink-0" />
        Ces informations servent aux feuilles de service : qui est convoqué, quand. La disponibilité des
        acteurs n’est pas prise en compte dans le calcul du planning.
      </p>

      <section aria-labelledby="acteurs-titre" className="flex flex-col gap-4">
        <h2 id="acteurs-titre" className="text-h2">
          Personnages et acteurs
        </h2>
        {characters.length === 0 ? (
          <p className="text-muted-on-light">Aucun personnage dans tes scènes pour l’instant.</p>
        ) : (
          <ul className="flex flex-col divide-y-2 divide-line-light border-2 border-ink bg-white">
            {characters.map((c) => {
              const a = actorFor(c);
              const inScenes = draft.scenes.filter((s) => s.characters.includes(c)).length;
              return (
                <li key={c} className="grid grid-cols-1 gap-3 p-4 md:grid-cols-12 md:items-end">
                  <div className="md:col-span-3">
                    <p className="font-display text-h3 font-bold">{c}</p>
                    <p className="text-meta text-muted-on-light">
                      {inScenes} scène{inScenes > 1 ? 's' : ''}
                    </p>
                    {a && detected.includes(a.id) && !a.name ? <AiDraftBadge className="mt-2" /> : null}
                  </div>
                  <Field
                    label="Joué·e par"
                    className="md:col-span-5"
                    error={!a?.name ? 'À compléter' : undefined}
                  >
                    <Input
                      value={a?.name ?? ''}
                      onChange={(e) => upsertActor(c, { name: e.target.value })}
                      placeholder="Nom de l’acteur ou de l’actrice"
                    />
                  </Field>
                  <Field label="Contact" optional className="md:col-span-4">
                    <Input
                      value={a?.contact ?? ''}
                      onChange={(e) => upsertActor(c, { contact: e.target.value })}
                      placeholder="Téléphone ou email"
                    />
                  </Field>
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
