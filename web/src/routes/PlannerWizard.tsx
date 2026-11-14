import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { CreateProjectInput, Project } from '@/api/types';
import { Button, ErrorState, Icon, LoadingBlock, PageHeader, Stepper, useToast } from '@/components/ui';
import { useAutosave, type AutosaveState } from '@/features/planner/hooks/useAutosave';
import { StepGenerate } from '@/features/planner/components/wizard/StepGenerate';
import { StepLocations } from '@/features/planner/components/wizard/StepLocations';
import { StepPeople } from '@/features/planner/components/wizard/StepPeople';
import { StepProject } from '@/features/planner/components/wizard/StepProject';
import { StepScreenplay } from '@/features/planner/components/wizard/StepScreenplay';
import type { Detected, PlannerDraft } from '@/features/planner/components/wizard/types';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useCreateProject, useCurrentProject, useUpdateProject } from '@/features/project/hooks/useProject';

const STEPS = [
  { id: 'projet', label: 'Projet' },
  { id: 'scenario', label: 'Scénario' },
  { id: 'lieux', label: 'Lieux' },
  { id: 'personnes', label: 'Personnes' },
  { id: 'generer', label: 'Générer' },
];

const DETECTED_KEY = (id: string) => `pp-ia-detected-${id}`;
function readDetected(id: string): Detected {
  try {
    return JSON.parse(sessionStorage.getItem(DETECTED_KEY(id)) ?? '') as Detected;
  } catch {
    return { locations: [], people: [] };
  }
}

function SaveIndicator({ state, onRetry }: { state: AutosaveState; onRetry: () => void }) {
  const map: Record<AutosaveState, string> = {
    idle: '',
    pending: 'Modifications en attente…',
    saving: 'Enregistrement…',
    saved: 'Enregistré',
    error: 'Échec de l’enregistrement',
  };
  if (state === 'idle') return null;
  return (
    <p
      role="status"
      className={
        state === 'error'
          ? 'flex items-center gap-2 text-meta font-semibold text-bad-fg'
          : 'flex items-center gap-2 text-meta text-muted-on-light'
      }
    >
      <Icon name={state === 'saved' ? 'check' : state === 'error' ? 'alert' : 'clock'} size={16} />
      {map[state]}
      {state === 'error' ? (
        <button type="button" onClick={onRetry} className="min-h-11 underline underline-offset-4">
          Réessayer
        </button>
      ) : null}
    </p>
  );
}

/** Étapes 2 à 5 : brouillon partagé + enregistrement automatique. */
function DraftSteps({
  project,
  step,
  goTo,
  flushRef,
}: {
  project: Project;
  step: number;
  goTo: (n: number) => void;
  flushRef: MutableRefObject<(() => Promise<void>) | null>;
}) {
  const update = useUpdateProject(project.id);
  const [draft, setDraftState] = useState<PlannerDraft>(() => ({
    scenes: project.scenes,
    locations: project.locations,
    people: project.people,
  }));
  const [detected, setDetected] = useState<Detected>(() => readDetected(project.id));
  const autosave = useAutosave(draft, (d) => update.mutateAsync(d));

  const onDetected = (d: Detected) => {
    const next = {
      locations: [...detected.locations, ...d.locations],
      people: [...detected.people, ...d.people],
    };
    setDetected(next);
    try {
      sessionStorage.setItem(DETECTED_KEY(project.id), JSON.stringify(next));
    } catch {
      /* stockage indisponible */
    }
  };

  const { flush } = autosave;
  useEffect(() => {
    flushRef.current = flush;
    return () => {
      flushRef.current = null;
    };
  }, [flush, flushRef]);

  const go = async (n: number) => {
    await flush();
    goTo(n);
  };

  const current = { ...project, ...draft };
  return (
    <>
      <div className="flex min-h-11 items-center justify-end">
        <SaveIndicator state={autosave.state} onRetry={() => void autosave.retry()} />
      </div>
      {step === 1 ? <StepScreenplay draft={draft} setDraft={setDraftState} onDetected={onDetected} /> : null}
      {step === 2 ? (
        <StepLocations draft={draft} setDraft={setDraftState} detected={detected.locations} />
      ) : null}
      {step === 3 ? <StepPeople draft={draft} setDraft={setDraftState} detected={detected.people} /> : null}
      {step === 4 ? <StepGenerate project={current} /> : null}
      <nav
        aria-label="Navigation de l’assistant"
        className="mt-10 flex flex-wrap justify-between gap-3 border-t-2 border-ink pt-6"
      >
        <Button variant="secondary" icon="arrowLeft" onClick={() => void go(step - 1)}>
          {STEPS[step - 1].label}
        </Button>
        {step < 4 ? (
          <Button
            iconRight="arrowRight"
            loading={autosave.state === 'saving'}
            onClick={() => void go(step + 1)}
          >
            Continuer : {STEPS[step + 1].label}
          </Button>
        ) : null}
      </nav>
    </>
  );
}

export default function PlannerWizard() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { setCurrentProject } = useAuth();
  const { toast } = useToast();
  const isNew = params.get('nouveau') === '1';
  const step = Math.min(4, Math.max(0, Number(params.get('etape') ?? '1') - 1));
  const project = useCurrentProject();
  const create = useCreateProject();
  const update = useUpdateProject(project.data?.id);
  /** Enregistre le brouillon avant de changer d'étape depuis le Stepper. */
  const flushRef = useRef<(() => Promise<void>) | null>(null);

  const goTo = (n: number) => {
    setParams({ etape: String(n + 1) });
    window.scrollTo({ top: 0 });
  };

  const submitProject = (v: CreateProjectInput) => {
    if (isNew || !project.data) {
      create.mutate(v, {
        onSuccess: (p) => {
          setCurrentProject(p.id);
          toast({ tone: 'ok', title: `« ${p.title} » créé` });
          navigate('/planner/projet?etape=2', { replace: true });
        },
        onError: (e) => toast({ tone: 'bad', title: 'Création impossible', description: e.message }),
      });
    } else {
      update.mutate(v, {
        onSuccess: () => goTo(1),
        onError: (e) => toast({ tone: 'bad', title: 'Enregistrement impossible', description: e.message }),
      });
    }
  };

  const p = isNew ? undefined : project.data;
  const done = p
    ? [
        true,
        p.scenes.length > 0,
        p.locations.length > 0 && p.locations.every((l) => l.address.trim()),
        p.people.some((x) => x.kind === 'equipe'),
        !!p.schedule,
      ]
    : [false, false, false, false, false];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={isNew ? 'Planifier · Nouveau film' : `Planifier · ${p?.title ?? 'Mon film'}`}
        title="Planifier tout mon film"
        lead="Cinq étapes. Chaque modification est enregistrée automatiquement."
      />
      <Stepper
        steps={STEPS.map((s, i) => ({ ...s, done: done[i] }))}
        current={step}
        onSelect={
          p
            ? (n) => {
                void (flushRef.current?.() ?? Promise.resolve()).then(() => goTo(n));
              }
            : undefined
        }
      />

      {!isNew && project.isPending ? (
        <LoadingBlock lines={6} />
      ) : !isNew && project.isError ? (
        <ErrorState error={project.error} onRetry={() => void project.refetch()} />
      ) : step === 0 || !p ? (
        <StepProject
          key={p?.id ?? 'nouveau'}
          project={p}
          onSubmit={submitProject}
          saving={create.isPending || update.isPending}
        />
      ) : (
        <DraftSteps key={p.id} project={p} step={step} goTo={goTo} flushRef={flushRef} />
      )}
    </div>
  );
}
