import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { Button, ButtonLink, Field, Input, TextArea, Select, PageHeader } from '@/components/ui';
import { analyzeScenario, inputSchema, type AnalyzedScene } from '@/features/planner/scenario/api';
import { DEMO, EXAMPLE_CONTENT, EXAMPLE_TITLE } from '@/features/planner/scenario/demo';
import { EMPTY, HANDOFF_KEY, readSession, SESSION_KEY } from '@/features/planner/scenario/storage';

const times = { DAY: 'Jour', NIGHT: 'Nuit', DAWN: 'Aube', DUSK: 'Crépuscule', UNKNOWN: 'À préciser' };
const listFields = {
  characters: 'Personnages',
  props: 'Accessoires',
  technical_requirements: 'Besoins techniques explicites',
  production_challenges: 'Difficultés explicites',
  missing_information: 'Informations à préciser',
  inferences: 'Interprétations IA',
  suggestions: 'Suggestions à valider',
} as const;

export default function ScenarioAnalysis() {
  const [session, setSession] = useState(readSession);
  const [editingInput, setEditingInput] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [storageError, setStorageError] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const active = useRef(true);
  const navigate = useNavigate();
  const mutation = useMutation({ mutationFn: analyzeScenario, retry: false });
  const { analysis } = session;
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      if (!session.confirmed) sessionStorage.removeItem(HANDOFF_KEY);
    } catch {
      // Report a failure while synchronizing with browser storage.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStorageError(true);
    }
  }, [session]);

  const input = inputSchema.safeParse({ title: session.title, content: session.content });
  const titleError = submitted && !session.title.trim() ? 'Indique un titre.' : undefined;
  const contentError =
    submitted && (session.content.trim().length < 30 || session.content.length > 100_000)
      ? 'Le scénario doit contenir entre 30 et 100 000 caractères.'
      : undefined;
  const changeInput = (key: 'title' | 'content', value: string) => {
    setSession((s) => ({ ...s, [key]: value, analysis: null, confirmed: false }));
    setError('');
  };
  const send = async () => {
    setSubmitted(true);
    setError('');
    if (!input.success) return;
    try {
      const result = await mutation.mutateAsync(input.data);
      if (active.current) {
        setSession((s) => ({ ...s, analysis: result, confirmed: false }));
        setEditingInput(false);
      }
    } catch (e) {
      if (active.current) setError(e instanceof Error ? e.message : 'Analyse impossible. Réessaie.');
    }
  };
  const updateScene = (scene: AnalyzedScene) => {
    setSession((s) => {
      if (!s.analysis) return s;
      const scenes = s.analysis.scenes.map((x) => (x.number === scene.number ? scene : x));
      const key = (name: string) => name.normalize('NFKC').trim().toLocaleLowerCase('fr');
      const canonical = new Map<string, string>();
      for (const name of scenes.flatMap((x) => x.characters)) {
        if (!name.trim() || canonical.has(key(name))) continue;
        canonical.set(
          key(name),
          s.analysis.characters.find((c) => key(c.name) === key(name))?.name ?? name.trim(),
        );
      }
      const names = [...canonical.values()];
      const characters = names.map((name) => ({
        ...(s.analysis!.characters.find((c) => key(c.name) === key(name)) ?? {
          name,
          description: '',
          production_observations: [],
        }),
        scenes: scenes.filter((x) => x.characters.some((n) => key(n) === key(name))).map((x) => x.number),
      }));
      return { ...s, confirmed: false, analysis: { ...s.analysis, scenes, characters } };
    });
  };
  const clear = () => {
    try {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(HANDOFF_KEY);
    } catch {
      setStorageError(true);
    }
    setSession(EMPTY);
    setEditingInput(false);
    setError('');
    setSubmitted(false);
    setEditing(null);
  };
  return (
    <div className="flex flex-col gap-7">
      <ButtonLink to="/planner/reperage" variant="secondary">
        Repérer les lieux et la météo des scènes
      </ButtonLink>
      <PageHeader
        eyebrow="Encadré · Préproduction"
        title="Dépouiller mon scénario"
        lead="L'IA propose, le cinéaste décide."
      />
      <div className="border-2 border-ink bg-gold-soft p-4 text-meta">
        Le texte est envoyé au modèle configuré côté serveur (Ollama ou Anthropic) uniquement quand tu
        demandes une analyse. Encadré ne le sauvegarde pas sur le serveur. Le scénario et les corrections
        restent dans cet onglet (session du navigateur). Ferme l’onglet ou utilise « Effacer ma session » pour
        les supprimer. Les conditions de traitement du fournisseur restent applicables.
      </div>
      {storageError && <p role="alert">Le stockage de session est indisponible. Garde cet écran ouvert.</p>}
      {(!analysis || editingInput) && (
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <Field label="Titre du scénario" error={titleError} required>
            <Input
              maxLength={200}
              value={session.title}
              disabled={mutation.isPending}
              onChange={(e) => changeInput('title', e.target.value)}
            />
          </Field>
          <Field
            label="Texte du scénario"
            error={contentError}
            hint={`${session.content.length} / 100 000 caractères`}
            required
          >
            <TextArea
              rows={14}
              className="font-mono"
              value={session.content}
              disabled={mutation.isPending}
              onChange={(e) => changeInput('content', e.target.value)}
            />
          </Field>
          <Field
            label="Importer un fichier .txt"
            hint="Texte UTF-8, 400 Ko maximum. Lecture locale uniquement."
          >
            <Input
              type="file"
              accept=".txt,text/plain"
              disabled={mutation.isPending}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (!file.name.toLowerCase().endsWith('.txt') || file.size > 400_000) {
                  setError('Choisis un fichier .txt de 400 Ko maximum.');
                  return;
                }
                try {
                  const content = await file.text();
                  if (content.length > 100_000) {
                    setError('Le fichier dépasse 100 000 caractères.');
                    return;
                  }
                  changeInput('content', content);
                } catch {
                  setError('Impossible de lire le fichier. Réessaie.');
                }
              }}
            />
          </Field>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" loading={mutation.isPending}>
              Analyser mon scénario
            </Button>
            <Button
              variant="secondary"
              disabled={mutation.isPending}
              onClick={() => {
                setSession({
                  title: EXAMPLE_TITLE,
                  content: EXAMPLE_CONTENT,
                  analysis: null,
                  confirmed: false,
                });
                setError('');
              }}
            >
              Charger l’exemple
            </Button>
            <Button
              variant="secondary"
              disabled={mutation.isPending}
              onClick={() => {
                setSession({
                  title: EXAMPLE_TITLE,
                  content: EXAMPLE_CONTENT,
                  analysis: structuredClone(DEMO),
                  confirmed: false,
                });
                setEditingInput(false);
                setError('');
              }}
            >
              Mode démo · données simulées
            </Button>
          </div>
          {mutation.isPending && (
            <p role="status">
              Analyse du scénario en cours… Identification des scènes et des personnages demandée à l’IA.
            </p>
          )}
        </form>
      )}
      {error && (
        <p role="alert" className="border-2 border-bad-fg bg-bad-bg p-4">
          {error}
        </p>
      )}
      {analysis && !editingInput && (
        <>
          <section className="border-2 border-ink bg-white p-5">
            <h2 className="text-h2">{analysis.title}</h2>
            <p role="status" className="mt-2 font-semibold">
              {session.confirmed ? 'Analyse validée par le cinéaste' : 'Brouillon IA : à valider'}
            </p>
            {analysis.simulated && (
              <p className="mt-2 bg-gold-soft p-3 font-semibold">
                Mode démo — données simulées de l’exemple fixe « Le premier jour ». Aucun appel IA.
              </p>
            )}
            <dl className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-5">
              {(
                [
                  ['Scènes', analysis.scenes.length],
                  ['Personnages', analysis.characters.length],
                  ['Intérieurs', analysis.scenes.filter((s) => s.setting === 'INT').length],
                  ['Extérieurs', analysis.scenes.filter((s) => s.setting === 'EXT').length],
                  [
                    'À préciser',
                    analysis.scenes.filter(
                      (s) =>
                        s.missing_information.length ||
                        s.setting === 'UNKNOWN' ||
                        s.time_of_day === 'UNKNOWN',
                    ).length,
                  ],
                ] as const
              ).map(([label, count]) => (
                <div key={label}>
                  <dt className="text-meta">{label}</dt>
                  <dd className="text-h2">{count}</dd>
                </div>
              ))}
            </dl>
          </section>
          <div className="grid items-start gap-6 lg:grid-cols-[2fr_1fr]">
            <section aria-label="Scènes" className="flex min-w-0 flex-col gap-5">
              {analysis.scenes.map((scene) => (
                <article key={scene.number} className="border-2 border-ink bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-h3">
                      {scene.number}. {scene.heading}
                    </h3>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditing(editing === scene.number ? null : scene.number)}
                    >
                      {editing === scene.number ? 'Terminer' : `Modifier la scène ${scene.number}`}
                    </Button>
                  </div>
                  <p className="my-3 text-meta font-semibold">
                    {scene.setting === 'UNKNOWN' ? 'INT/EXT à préciser' : scene.setting} ·{' '}
                    {times[scene.time_of_day]}
                  </p>
                  {editing === scene.number ? (
                    <div className="flex flex-col gap-3">
                      {(['heading', 'location', 'summary'] as const).map((key) => (
                        <Field
                          key={key}
                          label={key === 'heading' ? 'En-tête' : key === 'location' ? 'Lieu' : 'Résumé'}
                        >
                          <TextArea
                            rows={2}
                            value={scene[key]}
                            onChange={(e) => updateScene({ ...scene, [key]: e.target.value })}
                          />
                        </Field>
                      ))}
                      <Field label="INT/EXT">
                        <Select
                          value={scene.setting}
                          onChange={(e) =>
                            updateScene({ ...scene, setting: e.target.value as AnalyzedScene['setting'] })
                          }
                        >
                          {['INT', 'EXT', 'UNKNOWN'].map((v) => (
                            <option key={v} value={v}>
                              {v === 'UNKNOWN' ? 'À préciser' : v}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Moment">
                        <Select
                          value={scene.time_of_day}
                          onChange={(e) =>
                            updateScene({
                              ...scene,
                              time_of_day: e.target.value as AnalyzedScene['time_of_day'],
                            })
                          }
                        >
                          {Object.entries(times).map(([v, label]) => (
                            <option key={v} value={v}>
                              {label}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      {Object.entries(listFields).map(([key, label]) => (
                        <Field key={key} label={`${label} (une entrée par ligne)`}>
                          <TextArea
                            rows={2}
                            value={scene[key as keyof typeof listFields].join('\n')}
                            onChange={(e) => updateScene({ ...scene, [key]: e.target.value.split('\n') })}
                          />
                        </Field>
                      ))}
                    </div>
                  ) : (
                    <>
                      <p className="font-semibold">Lieu : {scene.location || 'Non précisé'}</p>
                      <p className="mt-2">{scene.summary || 'Non précisé'}</p>
                      <dl className="mt-4 flex flex-col gap-3">
                        {Object.entries(listFields).map(([key, label]) => (
                          <div
                            key={key}
                            className={
                              key === 'inferences' || key === 'suggestions'
                                ? 'border-l-4 border-gold pl-3'
                                : ''
                            }
                          >
                            <dt className="text-meta font-semibold">{label}</dt>
                            <dd className="whitespace-pre-line text-meta">
                              {scene[key as keyof typeof listFields].filter(Boolean).join('\n') ||
                                'Non précisé'}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </>
                  )}
                </article>
              ))}
            </section>
            <aside className="border-2 border-ink bg-paper p-5">
              <h2 className="text-h2">Personnages</h2>
              {analysis.characters.map((c, i) => (
                <div key={c.name} className="mt-5 border-t border-ink pt-4">
                  <h3 className="font-semibold">{c.name}</h3>
                  <p className="text-meta">Scènes {c.scenes.join(', ')}</p>
                  <Field label={`Description de ${c.name}`}>
                    <TextArea
                      rows={2}
                      value={c.description}
                      onChange={(e) =>
                        setSession((s) => ({
                          ...s,
                          confirmed: false,
                          analysis: {
                            ...analysis,
                            characters: analysis.characters.map((x, n) =>
                              n === i ? { ...x, description: e.target.value } : x,
                            ),
                          },
                        }))
                      }
                    />
                  </Field>
                  <Field label={`Observations de production de ${c.name}`}>
                    <TextArea
                      rows={2}
                      value={c.production_observations.join('\n')}
                      onChange={(e) =>
                        setSession((s) => ({
                          ...s,
                          confirmed: false,
                          analysis: {
                            ...analysis,
                            characters: analysis.characters.map((x, n) =>
                              n === i ? { ...x, production_observations: e.target.value.split('\n') } : x,
                            ),
                          },
                        }))
                      }
                    />
                  </Field>
                </div>
              ))}
            </aside>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setEditingInput(true);
                setEditing(null);
              }}
            >
              Retour au scénario
            </Button>
            <Button
              disabled={session.confirmed || analysis.scenes.some((s) => !s.heading.trim())}
              onClick={() => {
                setSession((s) => ({ ...s, confirmed: true }));
                setEditing(null);
              }}
            >
              Confirmer l’analyse
            </Button>
            <Button
              variant="secondary"
              disabled={!session.confirmed}
              onClick={() => {
                try {
                  sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(analysis));
                  navigate('/planner/projet?etape=2');
                } catch {
                  setStorageError(true);
                }
              }}
            >
              Continuer vers la planification
            </Button>
          </div>
          <p className="text-meta">
            Le transfert au projet sera proposé explicitement dans l’assistant. Les durées de tournage seront
            renseignées par toi.
          </p>
        </>
      )}
      <Button variant="ghost" disabled={mutation.isPending} onClick={clear}>
        Effacer ma session
      </Button>
    </div>
  );
}
