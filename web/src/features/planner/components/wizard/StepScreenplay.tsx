import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { demoParseFallback, isApiError } from '@/api';
import type { ParseScreenplayInput, ParseScreenplayResult, Person, Project, Scene } from '@/api/types';
import {
  AiDraftBadge,
  Button,
  Dialog,
  DialogContent,
  EmptyState,
  FileDrop,
  Icon,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TextArea,
  MoreInfo,
  useToast,
} from '@/components/ui';
import { useUpdateProject } from '@/features/project/hooks/useProject';
import { plural } from '@/lib/format';
import { useParseScreenplay } from '../../hooks/usePlanner';
import { localId, nextSceneNumber } from '../../lib/ids';
import { pruneSchedule, removeScene, restoreScene, scheduleHasScene } from '../../lib/removeScene';
import { SceneEditor, SceneSummaryBar } from './SceneEditor';
import { SceneSuggestions } from './SceneSuggestions';
import type { Detected, DraftSetter, PlannerDraft } from './types';

// Le serveur lit ces formats ; le fichier est envoyé tel quel (pas de conversion ici)
const ACCEPT = ['.pdf', '.docx', '.txt', '.fountain', '.fdx'];
const MAX_MB = 10;
const UNDO_MS = 6000;
const NO_AI = 'Découpage simple, sans IA. Réessaie dans un moment.';

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
  const fallback = useMutation({ mutationFn: (i: ParseScreenplayInput) => demoParseFallback!(i) });
  const update = useUpdateProject(project.id);
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [pending, setPending] = useState<ParseScreenplayResult | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const busy = parse.isPending || fallback.isPending;

  const apply = (r: ParseScreenplayResult, mode: 'replace' | 'append') => {
    setPending(null);
    const m = merge(draft, r, mode);
    setDraft(() => m.draft);
    onDetected(m.detected);
  };

  const received = (r: ParseScreenplayResult) => {
    // Sans IA : une seule ligne, pas la liste des avertissements du découpage simple
    setWarnings(r.ai_used === false ? [NO_AI] : r.warnings);
    if (!r.scenes.length) return;
    if (draft.scenes.length) setPending(r);
    else apply(r, 'replace');
  };

  const input = (): ParseScreenplayInput => (file ? { file } : { text });
  const send = () => {
    if (busy) return; // pas de double envoi
    fallback.reset();
    parse.mutate(input(), { onSuccess: received });
  };
  const useDemo = () => {
    parse.reset();
    fallback.mutate(input(), { onSuccess: received });
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

  /** Supprime la scène, ses lieux devenus inutiles et ses créneaux ; « Annuler » remet tout. */
  const deleteScene = (sceneId: string) => {
    const { draft: next, removal } = removeScene(draft, sceneId);
    if (!removal) return;
    setDraft(() => next);
    const schedule = project.schedule;
    const inSchedule = !!schedule && scheduleHasScene(schedule, sceneId);
    if (schedule && inSchedule) update.mutate({ schedule: pruneSchedule(schedule, removal) });
    const lost = removal.locations.length;
    toast({
      tone: 'info',
      title: 'Scène supprimée',
      description: lost ? `${plural(lost, 'lieu retiré', 'lieux retirés')} avec elle.` : undefined,
      duration: UNDO_MS,
      action: {
        label: 'Annuler',
        onClick: () => {
          setDraft((d) => restoreScene(d, removal));
          if (schedule && inSchedule) update.mutate({ schedule });
        },
      },
    });
  };

  const error = parse.error ?? fallback.error;
  const unreachable = isApiError(error) && (error.code === 'reseau' || error.code === 'delai_depasse');

  return (
    <div className="flex flex-col gap-8">
      <Tabs defaultValue={draft.scenes.length ? 'manuel' : 'import'}>
        <TabsList aria-label="Comment ajouter tes scènes">
          <TabsTrigger value="import">Importer mon scénario</TabsTrigger>
          <TabsTrigger value="manuel">Saisir à la main</TabsTrigger>
        </TabsList>
        <TabsContent value="import" className="flex flex-col gap-5">
          <div>
            <p className="flex items-center gap-2 text-meta text-muted-on-light">
              <Icon name="lock" size={16} className="shrink-0" />
              L’IA découpe ton texte. Il n’est pas conservé.
            </p>
            <MoreInfo>
              Ton scénario est découpé en scènes, lieux et personnages, puis oublié par le serveur. Il ne sert
              pas à entraîner une IA. Tu relis chaque scène.
            </MoreInfo>
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
            hint={`PDF, Word, TXT, Fountain ou Final Draft · ${MAX_MB} Mo maximum`}
          />
          <details className="border-2 border-line-light bg-white p-4">
            <summary className="min-h-11 cursor-pointer content-center font-semibold">
              Ou colle ton texte
            </summary>
            <p className="mt-2 text-meta text-muted-on-light">Un scénario ou un simple récit.</p>
            <TextArea
              aria-label="Texte du scénario"
              rows={8}
              className="mt-3 font-mono text-meta"
              placeholder={'INT. CAFÉ - JOUR\nAmira lève le rideau.\n\nOu : Amira ouvre le café à l’aube…'}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (e.target.value) setFile(null);
              }}
            />
          </details>
          <div className="flex flex-wrap items-center gap-3">
            <Button icon="sparkle" loading={busy} disabled={busy || (!file && !text.trim())} onClick={send}>
              {busy ? 'Lecture de ton scénario…' : 'Découper en scènes'}
            </Button>
            {busy ? (
              <span role="status" className="text-meta text-muted-on-light">
                Jusqu’à 30 secondes.
              </span>
            ) : null}
          </div>
          {error && !busy ? (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-3 border-2 border-bad-fg/40 bg-bad-bg p-3"
            >
              <p className="flex items-center gap-2 font-semibold text-bad-fg">
                <Icon name="alert" size={18} className="shrink-0" />
                {unreachable ? 'Serveur injoignable.' : error.message}
              </p>
              <Button size="sm" variant="secondary" onClick={send}>
                Réessayer
              </Button>
              {unreachable && demoParseFallback ? (
                <Button size="sm" variant="ghost" onClick={useDemo}>
                  Utiliser l’exemple de démo
                </Button>
              ) : null}
            </div>
          ) : null}
        </TabsContent>
        <TabsContent value="manuel">
          <p className="text-muted-on-light">Ajoute tes scènes une par une.</p>
        </TabsContent>
      </Tabs>

      {warnings.length ? (
        <ul className="flex flex-col gap-1.5 border-2 border-warn-fg/40 bg-warn-bg p-3 text-warn-fg">
          {warnings.map((w) => (
            <li key={w} className="flex items-start gap-2 text-meta">
              <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
              {w}
            </li>
          ))}
        </ul>
      ) : null}

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
            Importe ton scénario ou ajoute tes scènes.
          </EmptyState>
        ) : (
          draft.scenes.map((s) => (
            <SceneEditor
              key={s.id}
              scene={s}
              locations={draft.locations}
              onChange={updateScene}
              onDelete={() => deleteScene(s.id)}
            />
          ))
        )}
        {draft.locations.length === 0 && draft.scenes.length > 0 ? (
          <p className="flex items-center gap-2 text-meta text-warn-fg">
            <Icon name="alert" size={16} /> Ajoute tes lieux à l’étape suivante.
          </p>
        ) : null}
        <SceneSuggestions project={project} draft={draft} setDraft={setDraft} />
      </section>

      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent
          title={`${pending?.scenes.length ?? 0} scènes trouvées`}
          description={`Tu as déjà ${draft.scenes.length} scènes.`}
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
