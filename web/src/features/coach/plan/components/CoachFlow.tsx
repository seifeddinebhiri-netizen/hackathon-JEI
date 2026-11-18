import { useMemo, useState } from 'react';
import { coachIsReal } from '@/api';
import type { ShotTargets, Timeline } from '@/api/types';
import { Button, Icon } from '@/components/ui';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { CoachScreen } from '../../components/CoachScreen';
import { SAMPLE_TARGETS } from '../../measure/targets';
import { requestMotionPermission } from '../../measure/useOrientation';
import { loadMount, saveMount, type Mount } from '../../mount';
import { useWorkspaces } from '../useWorkspaces';
import { WorkspaceBar } from './WorkspaceBar';
import { WorkspacePanel } from './WorkspacePanel';

type Filming = { targets: ShotTargets; label: string; note: string; timeline?: Timeline };

function Workspaces({ userId, syncEnabled }: { userId: string; syncEnabled: boolean }) {
  const ws = useWorkspaces(userId, syncEnabled);
  const [filming, setFilming] = useState<Filming | null>(null);
  const [mount, setMount] = useState<Mount>(() => loadMount());
  const changeMount = (next: Mount) => {
    setMount(next);
    saveMount(next);
  };

  // iPhone : l'autorisation des capteurs se demande DANS le toucher, avant d'ouvrir la caméra.
  const film = (targets: ShotTargets, label: string, note = '', timeline?: Timeline) => {
    void requestMotionPermission().finally(() => setFilming({ targets, label, note, timeline }));
  };

  // Scènes du planning déjà prises par un AUTRE espace (pour ne pas les refaire sans le vouloir).
  const usedScenes = useMemo(() => {
    const used = new Map<string, string>();
    for (const w of ws.items) {
      const sceneId = w.plan?.request.scene_id;
      if (sceneId && w.id !== ws.active.id) used.set(sceneId, w.name);
    }
    return used;
  }, [ws.items, ws.active.id]);

  return (
    <div className="flex flex-col gap-6">
      {!coachIsReal ? (
        <p
          role="status"
          className="flex items-start gap-2 border-2 border-warn-fg bg-warn-bg p-3 text-meta font-semibold text-warn-fg"
        >
          <Icon name="info" size={16} className="mt-0.5 shrink-0" />
          Mode démonstration : le plan est un exemple simulé, l’IA n’est pas appelée.
        </p>
      ) : null}

      <WorkspaceBar
        items={ws.items}
        activeId={ws.active.id}
        onSelect={ws.select}
        onCreate={ws.create}
        onRename={ws.rename}
        onRemove={ws.remove}
        sync={ws.sync}
      />

      {/* `key` : chaque espace a son propre état (formulaire, génération en cours...). */}
      <div role="tabpanel" id={`espace-${ws.active.id}`} aria-labelledby={`espace-onglet-${ws.active.id}`}>
        <WorkspacePanel
          key={ws.active.id}
          workspace={ws.active}
          usedScenes={usedScenes}
          mount={mount}
          onMountChange={changeMount}
          onPlanChange={(plan) => ws.setPlan(ws.active.id, plan)}
          onFilm={film}
        />
      </div>

      <div className="border-t-2 border-line-light pt-4">
        <p className="text-meta text-muted-on-light">Pour juste tester la caméra, sans scène :</p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-1"
          onClick={() => film(SAMPLE_TARGETS, 'Plan d’exemple')}
        >
          Essayer la caméra avec un plan d’exemple
        </Button>
      </div>

      {filming ? (
        <CoachScreen
          targets={filming.targets}
          shotLabel={filming.label}
          shotNote={filming.note || undefined}
          timeline={filming.timeline}
          initialMount={mount}
          onMountChange={changeMount}
          onClose={() => setFilming(null)}
        />
      ) : null}
    </div>
  );
}

/**
 * Le parcours du Coach, par espaces de travail : un espace par scène (formulaire → plan en mots →
 * caméra). Les espaces sont gardés dans le téléphone et, avec un compte, enregistrés sur le serveur
 * pour survivre à la déconnexion et se retrouver sur un autre appareil.
 */
export function CoachFlow() {
  const { user, authMode } = useAuth();
  const userId = user?.id ?? 'anonyme';
  // Enregistrement sur le compte : seulement avec un vrai compte et un vrai backend.
  const syncEnabled = coachIsReal && authMode === 'supabase' && !!user;
  return <Workspaces key={userId} userId={userId} syncEnabled={syncEnabled} />;
}
