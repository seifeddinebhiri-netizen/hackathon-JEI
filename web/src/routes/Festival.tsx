import { useSearchParams } from 'react-router';
import type { FilmProfile, Project } from '@/api/types';
import {
  ErrorState,
  LoadingBlock,
  PageHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import { FilmPageTab } from '@/features/festival/components/FilmPageTab';
import { FindTab } from '@/features/festival/components/FindTab';
import { SelectionTab } from '@/features/festival/components/SelectionTab';
import { SubtitlesTab } from '@/features/festival/components/SubtitlesTab';
import { SynopsisTab } from '@/features/festival/components/SynopsisTab';
import { defaultProfile, useLocalDraft } from '@/features/festival/lib/localStore';
import { useProjectPassport } from '@/features/passport/hooks/usePassport';
import { useCurrentProject } from '@/features/project/hooks/useProject';

const TABS = [
  { value: 'trouver', label: 'Trouver mon festival' },
  { value: 'selection', label: 'Ma sélection' },
  { value: 'sous-titres', label: 'Sous-titres' },
  { value: 'synopsis', label: 'Synopsis' },
  { value: 'page-film', label: 'Page film' },
] as const;
type TabValue = (typeof TABS)[number]['value'];

function Kit({ project, aiDepartments }: { project: Project; aiDepartments: number }) {
  const [params, setParams] = useSearchParams();
  const raw = params.get('onglet');
  const tab: TabValue = TABS.some((t) => t.value === raw) ? (raw as TabValue) : 'trouver';
  const [profile, setProfile] = useLocalDraft<FilmProfile>(
    'film-profile',
    project.id,
    defaultProfile(project.format, aiDepartments),
  );

  return (
    <Tabs value={tab} onValueChange={(v) => setParams({ onglet: v }, { replace: true })}>
      <TabsList aria-label="Kit Festival">
        {TABS.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>
            {t.label}
            {t.value === 'selection' && project.festival_shortlist.length
              ? ` (${project.festival_shortlist.length})`
              : ''}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="trouver">
        <FindTab project={project} profile={profile} onProfile={setProfile} />
      </TabsContent>
      <TabsContent value="selection">
        <SelectionTab project={project} />
      </TabsContent>
      <TabsContent value="sous-titres">
        <SubtitlesTab project={project} />
      </TabsContent>
      <TabsContent value="synopsis">
        <SynopsisTab project={project} />
      </TabsContent>
      <TabsContent value="page-film">
        <FilmPageTab project={project} />
      </TabsContent>
    </Tabs>
  );
}

export default function Festival() {
  const project = useCurrentProject();
  const passport = useProjectPassport(project.data?.id);
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Étape 4 · Diffuser"
        title="Kit Festival"
        lead="Trouver les festivals compatibles, préparer chaque dossier, présenter ton film. La soumission et le paiement se font toujours sur le site officiel du festival."
      />
      {project.isPending ? (
        <LoadingBlock lines={8} />
      ) : project.isError ? (
        <ErrorState error={project.error} onRetry={() => void project.refetch()} />
      ) : (
        <Kit
          key={project.data.id}
          project={project.data}
          aiDepartments={passport.data?.declarations.filter((d) => d.used_ai).length ?? 0}
        />
      )}
    </div>
  );
}
