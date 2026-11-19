import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { BabaJamil } from '@/components/BabaJamil';
import type { DepartmentDeclaration, Passport as PassportT, Project } from '@/api/types';
import { Button, ErrorState, Icon, LoadingBlock, PageHeader, Skeleton } from '@/components/ui';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { safeReturnPath } from '@/features/festival/lib/retour';
import { AiLabel } from '@/features/passport/components/AiLabel';
import { DepartmentCard } from '@/features/passport/components/DepartmentCard';
import { DepartmentNav } from '@/features/passport/components/DepartmentNav';
import { BadgeExport, PdfAndSign, VerifyLink } from '@/features/passport/components/OutputsPanel';
import { useAiTools, useProjectPassport, useSavePassport } from '@/features/passport/hooks/usePassport';
import { DEPARTMENTS, LABEL_DISCLAIMER } from '@/features/passport/lib/labels';
import { useAutosave } from '@/features/planner/hooks/useAutosave';
import { NoProject } from '@/features/project/components/NoProject';
import { useCurrentProject, useCurrentProjectId } from '@/features/project/hooks/useProject';

function directorOf(project: Project, fallback: string): string {
  return project.people.find((p) => p.kind === 'equipe' && /réalisation/i.test(p.role))?.name || fallback;
}

function PassportEditor({ project, initial }: { project: Project; initial: PassportT | null }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Venu d'un dossier du Kit Festival : on y revient à la fin
  const retour = safeReturnPath(useSearchParams()[0].get('retour'));
  const tools = useAiTools();
  const save = useSavePassport();
  const [declarations, setDeclarations] = useState<DepartmentDeclaration[]>(initial?.declarations ?? []);
  // Données vivantes (mises à jour par l'enregistrement et la signature C2PA)
  const live = useProjectPassport(project.id);
  const shown = live.data ?? initial;
  const [current, setCurrent] = useState(() => {
    const firstEmpty = DEPARTMENTS.findIndex((d) => !initial?.declarations.some((x) => x.department === d));
    return firstEmpty < 0 ? 0 : firstEmpty;
  });
  const director = initial?.director ?? directorOf(project, user?.name ?? '');

  const autosave = useAutosave(declarations, async (decls) => {
    await save.mutateAsync({
      id: shown?.id,
      project_id: project.id,
      film_title: project.title,
      director,
      declarations: decls,
    });
  });

  const update = (d: DepartmentDeclaration) =>
    setDeclarations((xs) => {
      const rest = xs.filter((x) => x.department !== d.department);
      // ordre stable des départements
      return [...rest, d].sort(
        (a, b) => DEPARTMENTS.indexOf(a.department) - DEPARTMENTS.indexOf(b.department),
      );
    });

  const dep = DEPARTMENTS[current];
  const declared = declarations.length;

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-start">
      {/* Élément principal : l'Étiquette IA et le lien vérifiable */}
      <div className="lg:col-span-5 lg:row-start-1" aria-label="Étiquette IA" role="region">
        <div className="flex flex-col gap-6">
          <AiLabel
            filmTitle={project.title}
            director={director}
            badgeCode={shown?.badge_code}
            declarations={declarations}
            tools={tools.data ?? []}
            className="shadow-hard"
          />
          <p role="status" className="flex items-center gap-2 text-meta text-muted-on-light">
            <Icon
              name={autosave.state === 'error' ? 'alert' : autosave.state === 'saved' ? 'check' : 'clock'}
              size={14}
            />
            {autosave.state === 'saving'
              ? 'Enregistrement…'
              : autosave.state === 'pending'
                ? 'Modifications en attente…'
                : autosave.state === 'error'
                  ? 'Échec de l’enregistrement'
                  : shown
                    ? 'Enregistré'
                    : 'Réponds à une première question pour créer ton Passeport.'}
            {autosave.state === 'error' ? (
              <button type="button" className="min-h-11 underline" onClick={() => void autosave.retry()}>
                Réessayer
              </button>
            ) : null}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:col-span-7 lg:col-start-6 lg:row-span-2 lg:row-start-1">
        {retour ? (
          <p className="flex items-start gap-2 border-2 border-ink bg-gold-soft p-3 text-meta">
            <Icon name="info" size={16} className="mt-0.5 shrink-0" />
            Tu viens de ton dossier de festival. Réponds pour les {DEPARTMENTS.length} départements, puis «
            Terminer et revenir à mon dossier ».
          </p>
        ) : null}
        <BabaJamil
          pose="declarer"
          taille="s"
          bulle="Ici, on dit tout : ce qui est humain et ce qui vient de l’IA."
        />
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-h3">Ta déclaration</h2>
          <p className="text-meta text-muted-on-light">
            {declared}/{DEPARTMENTS.length} départements
          </p>
        </div>
        <DepartmentNav declarations={declarations} current={current} onSelect={setCurrent} />
        {tools.isError ? (
          <ErrorState
            title="Catalogue des outils indisponible"
            error={tools.error}
            onRetry={() => void tools.refetch()}
          />
        ) : tools.isPending ? (
          <Skeleton className="h-80" />
        ) : (
          <DepartmentCard
            key={dep}
            department={dep}
            index={current}
            declaration={declarations.find((d) => d.department === dep)}
            tools={tools.data}
            onChange={update}
          />
        )}
        <div className="flex flex-wrap justify-between gap-3">
          <Button
            variant="secondary"
            icon="arrowLeft"
            disabled={current === 0}
            onClick={() => setCurrent((c) => c - 1)}
          >
            Précédent
          </Button>
          {current < DEPARTMENTS.length - 1 ? (
            <Button iconRight="arrowRight" onClick={() => setCurrent((c) => c + 1)}>
              Département suivant
            </Button>
          ) : retour ? (
            <Button
              iconRight="arrowRight"
              className="whitespace-normal! text-left"
              disabled={declared < DEPARTMENTS.length || autosave.state === 'saving'}
              onClick={() => void autosave.flush().then(() => navigate(retour))}
            >
              Terminer et revenir à mon dossier
            </Button>
          ) : (
            <Button
              iconRight="arrowRight"
              disabled={!shown}
              onClick={() =>
                document.getElementById('sorties')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            >
              Voir le lien, le PDF et le badge
            </Button>
          )}
        </div>
        <p className="flex items-start gap-2 border-l-4 border-gold pl-3 text-meta text-muted-on-light">
          <Icon name="info" size={16} className="mt-0.5 shrink-0" />
          {LABEL_DISCLAIMER} Le statut d’un outil décrit ce que publie son fournisseur, pas ton travail.
        </p>
      </div>

      <section
        id="sorties"
        aria-label="Lien de vérification, PDF et badge"
        className="flex scroll-mt-24 flex-col gap-6 lg:col-span-5 lg:row-start-2"
      >
        {shown ? (
          <>
            <VerifyLink passport={shown} />
            <PdfAndSign key={`${shown.id}-${shown.updated_at}`} passport={shown} />
            <BadgeExport passport={shown} />
          </>
        ) : null}
      </section>
    </div>
  );
}

export default function Passport() {
  const projectId = useCurrentProjectId();
  const project = useCurrentProject();
  const passport = useProjectPassport(project.data?.id);
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Étape 3 · Déclarer"
        title="Passeport IA"
        lead="Ce que l’IA a fait, ce que tu as décidé. Vérifiable par les festivals."
      />
      {!projectId ? (
        <NoProject>Le Passeport IA se remplit pour un film : crée d’abord ton projet.</NoProject>
      ) : project.isPending || (project.data && passport.isPending) ? (
        <LoadingBlock lines={8} label="Chargement du Passeport…" />
      ) : project.isError ? (
        <ErrorState error={project.error} onRetry={() => void project.refetch()} />
      ) : passport.isError ? (
        <ErrorState error={passport.error} onRetry={() => void passport.refetch()} />
      ) : (
        <PassportEditor key={project.data.id} project={project.data} initial={passport.data ?? null} />
      )}
    </div>
  );
}
