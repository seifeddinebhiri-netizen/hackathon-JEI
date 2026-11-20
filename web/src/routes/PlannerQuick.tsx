import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { BabaJamil } from '@/components/BabaJamil';
import type { QuickSlot, QuickSlotRequest } from '@/api/types';
import { ErrorState, Icon, LoadingBlock, MoreInfo, PageHeader, useToast } from '@/components/ui';
import { QuickResults } from '@/features/planner/components/QuickResults';
import { QuickSceneForm } from '@/features/planner/components/QuickSceneForm';
import { useOptimisticProjectUpdate, useQuickSlots } from '@/features/planner/hooks/usePlanner';
import { localId, nextSceneNumber } from '@/features/planner/lib/ids';
import { useCurrentProject } from '@/features/project/hooks/useProject';

export default function PlannerQuick() {
  const quick = useQuickSlots();
  const project = useCurrentProject();
  const [params] = useSearchParams();
  // « Décaler à… » depuis une scène du film : formulaire pré-rempli, pas d'ajout en double
  const fromScene = project.data?.scenes.find((s) => s.id === params.get('scene'));
  const fromLocation = project.data?.locations.find((l) => l.id === fromScene?.location_id);
  const initial: Partial<QuickSlotRequest> | undefined = fromScene
    ? {
        description: fromScene.summary || fromScene.title,
        place: fromLocation?.address || fromLocation?.name || project.data?.city,
        setting: fromScene.setting,
        moment: fromScene.moment,
      }
    : undefined;
  const update = useOptimisticProjectUpdate(project.data?.id);
  const { toast } = useToast();
  const [lastReq, setLastReq] = useState<QuickSlotRequest>();
  const [added, setAdded] = useState<string>();

  const submit = (req: QuickSlotRequest) => {
    setLastReq(req);
    setAdded(undefined);
    quick.mutate(req);
  };

  const addToFilm = (slot: QuickSlot) => {
    const p = project.data;
    if (!p || !lastReq || !quick.data) return;
    const place = quick.data.place;
    const existing = p.locations.find((l) => l.name.toLowerCase() === lastReq.place.trim().toLowerCase());
    const location = existing ?? {
      id: localId('loc'),
      name: lastReq.place.trim(),
      address: place.label,
      lat: place.lat,
      lon: place.lon,
      forbidden_days: [],
      permit: 'non_necessaire' as const,
    };
    const scene = {
      id: localId('sc'),
      number: nextSceneNumber(p.scenes.map((s) => s.number)),
      title: lastReq.description.trim().split(/[.!?]/)[0].slice(0, 48),
      setting: lastReq.setting,
      moment: lastReq.moment,
      location_id: location.id,
      characters: [],
      estimated_hours: 1.5,
      summary: lastReq.description.trim(),
      source: 'manuel' as const,
      validated: true,
    };
    update.mutate(
      { scenes: [...p.scenes, scene], locations: existing ? p.locations : [...p.locations, location] },
      {
        onSuccess: () => {
          setAdded(slot.start);
          toast({
            tone: 'ok',
            title: `Scène ${scene.number} ajoutée à « ${p.title} »`,
            description: 'Elle apparaîtra dans le calendrier, parmi les scènes non placées.',
          });
        },
        onError: (e) => toast({ tone: 'bad', title: 'Ajout impossible', description: e.message }),
      },
    );
  };

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        eyebrow="Planifier · Créneau"
        title={fromScene ? `Décaler la scène ${fromScene.number}` : 'Trouver un créneau'}
        lead="Les meilleurs moments selon la lumière et la météo."
      />
      <MoreInfo>Au-delà de 14 jours, la météo n’est pas connue : seule la lumière compte.</MoreInfo>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        <section aria-label="Ta scène" className="lg:col-span-4">
          {project.isPending && params.get('scene') ? (
            <LoadingBlock lines={4} />
          ) : (
            <QuickSceneForm
              key={fromScene?.id ?? 'libre'}
              onSubmit={submit}
              loading={quick.isPending}
              defaultPlace={project.data?.city}
              initial={initial}
            />
          )}
        </section>
        <section aria-label="Créneaux proposés" aria-live="polite" className="lg:col-span-8">
          {quick.isPending ? (
            <LoadingBlock label="Recherche des créneaux…" lines={6} />
          ) : quick.isError ? (
            <ErrorState error={quick.error} onRetry={() => lastReq && quick.mutate(lastReq)} />
          ) : quick.data ? (
            <div className="flex flex-col gap-4">
              <p className="flex items-center gap-2 text-meta text-muted-on-light">
                <Icon name="info" size={16} className="shrink-0" />
                Vérifie toujours sur place.
              </p>
              <QuickResults
                result={quick.data}
                onAdd={project.data && !fromScene ? addToFilm : undefined}
                adding={update.isPending}
                addedSlot={added}
              />
            </div>
          ) : (
            <div className="flex h-full min-h-64 flex-col items-start justify-center gap-4 border-2 border-dashed border-ink/40 p-8">
              <BabaJamil
                pose="planifier"
                taille="m"
                bulle="Donne-moi ta scène, je te trouve le meilleur moment pour la tourner."
              />
              <p className="font-display text-h3 font-bold">Les créneaux apparaîtront ici.</p>
              <p className="max-w-md text-muted-on-light">Du plus conseillé au moins conseillé.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
