import { useState } from 'react';
import type { Project } from '@/api/types';
import { Button, Dialog, DialogContent, useToast, type ButtonProps } from '@/components/ui';
import { useGenerateSchedule, useOptimisticProjectUpdate } from '../hooks/usePlanner';

/**
 * Générer / régénérer le planning.
 * - scènes non validées : avertissement « générer quand même ? »
 * - planning existant : confirmation « tes déplacements seront remplacés »
 * - après régénération : toast « Planning régénéré · Annuler » (8 s) qui restaure le précédent
 */
export function GenerateScheduleButton({
  project,
  onDone,
  ...buttonProps
}: { project: Project; onDone?: () => void } & Omit<ButtonProps, 'onClick'>) {
  const generate = useGenerateSchedule(project.id);
  const restore = useOptimisticProjectUpdate(project.id);
  const { toast } = useToast();
  const [step, setStep] = useState<'idle' | 'unvalidated' | 'overwrite'>('idle');

  const unvalidated = project.scenes.filter((s) => !s.validated).length;
  const hasSchedule = !!project.schedule;

  const run = () => {
    setStep('idle');
    generate.mutate(undefined, {
      onSuccess: ({ schedule, previous }) => {
        const n = schedule.days.reduce((a, d) => a + d.scenes.length, 0);
        if (previous) {
          toast({
            tone: 'ok',
            title: 'Planning régénéré',
            description: `${n} scènes placées sur ${schedule.days.length} jours.`,
            duration: 8000,
            action: {
              label: 'Annuler',
              onClick: () =>
                restore.mutate(
                  { schedule: previous },
                  { onSuccess: () => toast({ tone: 'info', title: 'Planning précédent restauré' }) },
                ),
            },
          });
        } else {
          toast({
            tone: 'ok',
            title: 'Planning généré',
            description: `${n} scènes placées sur ${schedule.days.length} jours.`,
          });
        }
        onDone?.();
      },
      onError: (e) =>
        toast({ tone: 'bad', title: 'Le planning n’a pas pu être généré', description: e.message }),
    });
  };

  const start = () => {
    if (unvalidated > 0) setStep('unvalidated');
    else if (hasSchedule) setStep('overwrite');
    else run();
  };

  return (
    <>
      <Button
        icon="sparkle"
        loading={generate.isPending}
        disabled={project.scenes.length === 0}
        onClick={start}
        {...buttonProps}
      >
        {buttonProps.children ?? (hasSchedule ? 'Régénérer le planning' : 'Générer le planning')}
      </Button>

      <Dialog open={step === 'unvalidated'} onOpenChange={(o) => !o && setStep('idle')}>
        <DialogContent
          title={`${unvalidated} scène${unvalidated > 1 ? 's' : ''} pas encore validée${unvalidated > 1 ? 's' : ''}`}
          description="Le découpage proposé par l’IA n’a pas été entièrement relu. Tu peux générer quand même et corriger ensuite."
        >
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="ghost" onClick={() => setStep('idle')}>
              Relire d’abord
            </Button>
            <Button onClick={() => (hasSchedule ? setStep('overwrite') : run())}>Générer quand même</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={step === 'overwrite'} onOpenChange={(o) => !o && setStep('idle')}>
        <DialogContent
          title="Remplacer le planning actuel ?"
          description="Un nouveau brouillon va remplacer le planning actuel, y compris tes déplacements à la main. Tu pourras annuler pendant quelques secondes."
        >
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="ghost" onClick={() => setStep('idle')}>
              Garder le planning actuel
            </Button>
            <Button icon="sparkle" onClick={run}>
              Régénérer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
