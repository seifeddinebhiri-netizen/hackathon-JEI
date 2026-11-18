import { useIsMutating } from '@tanstack/react-query';
import { useState } from 'react';
import type { ShotChoices, ShotSpecRequest, ShotTargets, Timeline } from '@/api/types';
import { Button, EmptyState, LoadingBlock } from '@/components/ui';
import { useCurrentProject } from '@/features/project/hooks/useProject';
import type { Mount } from '../../mount';
import { withOverride } from '../resolve';
import { timelinesEqual } from '../timeline';
import { NOTE_MAX, type StoredPlan } from '../store';
import { useCalibration, useGeneratePlan } from '../usePlan';
import type { Workspace } from '../workspaces';
import { MountPicker } from './MountPicker';
import { SceneForm } from './SceneForm';
import { ShotCard } from './ShotCard';

/**
 * Le contenu d'un espace de travail : 1. décrire la scène  →  2. lire et modifier le plan proposé
 * par l'IA  →  3. filmer. Chaque espace garde sa scène, son plan, ses modifications et ses étiquettes.
 */
export function WorkspacePanel({
  workspace,
  usedScenes,
  mount,
  onMountChange,
  onPlanChange,
  onFilm,
}: {
  workspace: Workspace;
  /** Scènes du planning déjà prises par un autre espace (identifiant → nom de l'espace). */
  usedScenes: ReadonlyMap<string, string>;
  mount: Mount;
  onMountChange: (m: Mount) => void;
  onPlanChange: (plan: StoredPlan | null) => void;
  onFilm: (targets: ShotTargets, label: string, note: string, timeline?: Timeline) => void;
}) {
  const project = useCurrentProject();
  const calibration = useCalibration();
  const plan = workspace.plan;
  const [editingScene, setEditingScene] = useState(false);

  const generate = useGeneratePlan(workspace.id, (spec, request) => {
    onPlanChange({
      request,
      spec,
      overrides: {},
      notes: {},
      timelines: {},
      savedAt: new Date().toISOString(),
    });
    setEditingScene(false);
  });
  // Une génération lancée pendant que l'utilisateur était dans un autre espace est encore en cours.
  const generatingElsewhere = useIsMutating({ mutationKey: ['coach', 'generate', workspace.id] }) > 0;
  const pending = generate.isPending || generatingElsewhere;

  const submit = (request: ShotSpecRequest) => generate.mutate(request);

  const setNote = (shotId: string, text: string) => {
    if (!plan) return;
    const notes = { ...plan.notes };
    if (text.trim()) notes[shotId] = text.slice(0, NOTE_MAX);
    else delete notes[shotId];
    onPlanChange({ ...plan, notes });
  };

  const setChoice = <K extends keyof ShotChoices>(shotId: string, key: K, value: ShotChoices[K]) => {
    if (!plan) return;
    const shot = plan.spec.shots.find((s) => s.id === shotId);
    if (!shot) return;
    const next = withOverride(plan.overrides[shotId], shot.intent, key, value);
    const overrides = { ...plan.overrides };
    if (Object.keys(next).length === 0) delete overrides[shotId];
    else overrides[shotId] = next;
    onPlanChange({ ...plan, overrides });
  };

  const setTimeline = (shotId: string, next: Timeline | null) => {
    if (!plan) return;
    const shot = plan.spec.shots.find((s) => s.id === shotId);
    const timelines = { ...plan.timelines };
    // Revenir à la proposition de l'IA (ou la retrouver à l'identique) : plus rien à garder.
    if (next === null || (shot?.timeline && timelinesEqual(next, shot.timeline))) delete timelines[shotId];
    else timelines[shotId] = next;
    onPlanChange({ ...plan, timelines });
  };

  const vocabulary = calibration.data?.vocabulary ?? [];

  if (!plan || editingScene) {
    return (
      <SceneForm
        scenes={project.data?.scenes ?? []}
        locations={project.data?.locations ?? []}
        usedScenes={usedScenes}
        initial={plan?.request}
        pending={pending}
        error={generate.error}
        onSubmit={submit}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Button variant="secondary" size="sm" onClick={() => setEditingScene(true)}>
          Modifier la scène
        </Button>
      </div>
      <p className="border-l-4 border-gold pl-3 text-meta text-muted-on-light">
        Voici le plan proposé pour ta scène, en mots. Tu peux tout changer : les chiffres que le téléphone
        vérifie se recalculent tout de suite, même sans connexion. Tu restes le réalisateur.
      </p>

      <MountPicker mount={mount} onChange={onMountChange} />

      {calibration.isPending && !calibration.data ? <LoadingBlock /> : null}
      {plan.spec.shots.length === 0 ? (
        <EmptyState icon="film" title="Aucun plan proposé">
          Réessaie avec plus de détails sur la scène.
        </EmptyState>
      ) : (
        plan.spec.shots.map((shot, i) => (
          <ShotCard
            key={shot.id}
            index={i}
            total={plan.spec.shots.length}
            timelineEdit={plan.timelines[shot.id]}
            onTimelineChange={(next) => setTimeline(shot.id, next)}
            shot={shot}
            overrides={plan.overrides[shot.id]}
            calibration={calibration.data}
            specCalibration={plan.spec.calibration}
            vocabulary={vocabulary}
            note={plan.notes[shot.id] ?? ''}
            onNote={(text) => setNote(shot.id, text)}
            onChange={(key, value) => setChoice(shot.id, key, value)}
            onResetField={(key) => setChoice(shot.id, key, shot.intent[key])}
            onResetAll={() => {
              const { [shot.id]: _removed, ...rest } = plan.overrides;
              void _removed;
              onPlanChange({ ...plan, overrides: rest });
            }}
            onFilm={onFilm}
          />
        ))
      )}
    </div>
  );
}
