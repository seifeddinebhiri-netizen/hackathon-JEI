import { useState } from 'react';
import type { ParseScreenplayResult, Person, Project, Scene } from '@/api/types';
import {
  AiDraftBadge,
  Button,
  Dialog,
  DialogContent,
  EmptyState,
  ErrorState,
  FileDrop,
  Icon,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TextArea,
} from '@/components/ui';
import { useParseScreenplay } from '../../hooks/usePlanner';
import { localId, nextSceneNumber } from '../../lib/ids';
import { SceneEditor, SceneSummaryBar } from './SceneEditor';
import { SceneSuggestions } from './SceneSuggestions';
import type { Detected, DraftSetter, PlannerDraft } from './types';

// Le découpage par l'IA lit du texte : fichiers texte, ou texte collé
const ACCEPT = ['.txt', '.fountain'];
const MAX_MB = 10;

/** Fusionne le résultat du découpage dans le brouillon (lieux par nom, personnages → acteurs à préciser). */
function merge(
  draft: PlannerDraft,
  r: ParseScreenplayResult,
  mode: 'replace' | 'append',
): { draft: PlannerDraft; detected: Detected } {
  const locations = [...draft.locations];
  const locIdMap = new Map<string, string>();
  const newLocs: string[] = [];
  for (const l of r.locations) {
    const same = locations.find((x) => x.name.trim().toLowerCase() === l.name.trim().toLowerCase());
    if (same) locIdMap.set(l.id, same.id);
    else {
      locations.push(l);
      locIdMap.set(l.id, l.id);
      newLocs.push(l.id);
    }
  }
  const people = [...draft.people];
  const newPeople: string[] = [];
  for (const c of r.characters) {
    if (!people.some((p) => p.kind === 'acteur' && p.character?.toLowerCase() === c.toLowerCase())) {
      const p: Person = { id: localId('p'), kind: 'acteur', name: '', role: 'Acteur·rice', character: c };
      people.push(p);
      newPeople.push(p.id);
    }
  }
  const base = mode === 'replace' ? [] : draft.scenes;
  let n = Number(nextSceneNumber(base.map((s) => s.number))) - 1;
  const parsed: Scene[] = r.scenes.map((s) => ({
    ...s,
    number: mode === 'replace' ? s.number : String(++n),
    location_id: locIdMap.get(s.location_id) ?? s.location_id,
    // Extrait du texte gardé pour les propositions de lieux (1 200 caractères au plus)
    excerpt: s.excerpt?.slice(0, 1200) || undefined,
  }));
  return {
    draft: { scenes: [...base, ...parsed], locations, people },
    detected: { locations: newLocs, people: newPeople },
  };
}

export function StepScreenplay({
  project,
  draft,
  setDraft,
  onDetected,
}: {
  project: Project;
  draft: PlannerDraft;
  setDraft: DraftSetter;
  onDetected: (d: Detected) => void;
}) {
  const parse = useParseScreenplay();
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [pending, setPending] = useState<ParseScreenplayResult | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const apply = (r: ParseScreenplayResult, mode: 'replace' | 'append') => {
    setPending(null);
    const m = merge(draft, r, mode);
    setDraft(() => m.draft);
    onDetected(m.detected);
    setWarnings(r.warnings);
  };

  const send = () => {
    parse.mutate(file ? { file } : { text }, {
      onSuccess: (r) => {
        if (!r.scenes.length) {
          setWarnings(r.warnings);
          return;
        }
        if (draft.scenes.length) setPending(r);
        else apply(r, 'replace');
      },
    });
  };

  const updateScene = (s: Scene) =>
    setDraft((d) => ({ ...d, scenes: d.scenes.map((x) => (x.id === s.id ? s : x)) }));
  const addScene = () =>
    setDraft((d) => ({
      ...d,
      scenes: [
        ...d.scenes,
        {
          id: localId('sc'),
          number: nextSceneNumber(d.scenes.map((s) => s.number)),
          title: '',
          setting: 'INT',
          moment: 'jour',
          location_id: d.locations[0]?.id ?? '',
          characters: [],
          estimated_hours: 1,
          summary: '',
          source: 'manuel',
          validated: true,
        },
      ],
    }));

  return (
    <div className="flex flex-col gap-8">
      <Tabs defaultValue={draft.scenes.length ? 'manuel' : 'import'}>
        <TabsList aria-label="Comment ajouter tes scènes">
          <TabsTrigger value="import">Importer mon scénario</TabsTrigger>
          <TabsTrigger value="manuel">Saisir à la main</TabsTrigger>
        </TabsList>
        <TabsContent value="import" className="flex flex-col gap-5">
          <div className="flex items-start gap-3 border-2 border-ink bg-gold-soft p-4">
            <Icon name="lock" size={20} className="mt-0.5 shrink-0" />
            <p>
              Ton scénario est envoyé à l’IA pour être découpé en scènes, décors et personnages. Il n’est pas
              conservé après le découpage et ne sert pas à entraîner une IA. Tu relis et tu valides chaque
              scène.
            </p>
          </div>
          <FileDrop
            accept={ACCEPT}
            maxSizeMb={MAX_MB}
            file={file}
            onFile={(f) => {
              setFile(f);
              if (f) setText('');
            }}
            label="Dépose ton scénario ici"
            hint={`TXT ou Fountain · ${MAX_MB} Mo maximum · ou colle le texte ci-dessous`}
          />
          <details className="border-2 border-line-light bg-white p-4">
            <summary className="min-h-11 cursor-pointer content-center font-semibold">
              Ou colle le texte du scénario
            </summary>
            <TextArea
              aria-label="Texte du scénario"
              rows={8}
              className="mt-3 font-mono text-meta"
              placeholder={'INT. CAFÉ - JOUR\nAmira lève le rideau.\n\nMOUNIR\nLe café est vendu.'}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (e.target.value) setFile(null);
              }}
            />
          </details>
          <div className="flex flex-wrap items-center gap-3">
            <Button icon="sparkle" loading={parse.isPending} disabled={!file && !text.trim()} onClick={send}>
              Découper en scènes
            </Button>
            {parse.isPending ? (
              <span className="text-meta text-muted-on-light">Découpage en cours…</span>
            ) : null}
          </div>
          {parse.isError ? (
            <ErrorState title="Le découpage a échoué" error={parse.error} onRetry={send} />
          ) : null}
        </TabsContent>
        <TabsContent value="manuel">
          <p className="max-w-prose text-muted-on-light">
            Ajoute tes scènes une par une. Tu peux aussi importer ton scénario puis corriger le découpage ici.
          </p>
        </TabsContent>
      </Tabs>

      {warnings.length ? (
        <ul className="flex flex-col gap-2 border-2 border-warn-fg/40 bg-warn-bg p-4 text-warn-fg">
          {warnings.map((w) => (
            <li key={w} className="flex items-start gap-2 text-meta">
              <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
              {w}
            </li>
          ))}
        </ul>
      ) : null}

      <SceneSuggestions project={project} draft={draft} setDraft={setDraft} />

      <section aria-labelledby="scenes-titre" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="scenes-titre" className="text-h2">
            Tes scènes
          </h2>
          {draft.scenes.some((s) => s.source === 'import_ia') ? (
            <AiDraftBadge validated={draft.scenes.every((s) => s.validated)} />
          ) : null}
        </div>
        <SceneSummaryBar
          scenes={draft.scenes}
          onAdd={addScene}
          onValidateAll={() =>
            setDraft((d) => ({ ...d, scenes: d.scenes.map((s) => ({ ...s, validated: true })) }))
          }
        />
        {draft.scenes.length === 0 ? (
          <EmptyState
            icon="film"
            title="Aucune scène pour l’instant"
            action={
              <Button icon="plus" onClick={addScene}>
                Ajouter une scène
              </Button>
            }
          >
            Importe ton scénario ou ajoute tes scènes à la main.
          </EmptyState>
        ) : (
          draft.scenes.map((s) => (
            <SceneEditor
              key={s.id}
              scene={s}
              locations={draft.locations}
              onChange={updateScene}
              onDelete={() => setDraft((d) => ({ ...d, scenes: d.scenes.filter((x) => x.id !== s.id) }))}
            />
          ))
        )}
        {draft.locations.length === 0 && draft.scenes.length > 0 ? (
          <p className="flex items-center gap-2 text-meta text-warn-fg">
            <Icon name="alert" size={16} /> Ajoute tes lieux à l’étape suivante pour les associer aux scènes.
          </p>
        ) : null}
      </section>

      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent
          title={`${pending?.scenes.length ?? 0} scènes trouvées`}
          description={`Tu as déjà ${draft.scenes.length} scènes. Que veux-tu faire du nouveau découpage ?`}
        >
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="ghost" onClick={() => setPending(null)}>
              Annuler
            </Button>
            <Button variant="secondary" onClick={() => pending && apply(pending, 'append')}>
              Ajouter à la suite
            </Button>
            <Button onClick={() => pending && apply(pending, 'replace')}>Remplacer mes scènes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
