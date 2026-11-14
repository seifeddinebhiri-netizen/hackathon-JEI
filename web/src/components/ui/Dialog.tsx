import * as RDialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from './Icon';

export const Dialog = RDialog.Root;
export const DialogTrigger = RDialog.Trigger;
export const DialogClose = RDialog.Close;

export function DialogContent({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <RDialog.Portal>
      <RDialog.Overlay className="fixed inset-0 z-50 bg-ink/70" />
      <RDialog.Content
        className={cn(
          'fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-[calc(100vw-32px)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto',
          'border-2 border-ink bg-paper p-6 shadow-hard',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <RDialog.Title className="font-display text-h3 font-bold">{title}</RDialog.Title>
          <RDialog.Close className="grid size-11 shrink-0 place-items-center hover:bg-ink/5" aria-label="Fermer">
            <Icon name="x" />
          </RDialog.Close>
        </div>
        {description ? (
          <RDialog.Description className="mt-2 text-muted-on-light">{description}</RDialog.Description>
        ) : (
          <RDialog.Description className="sr-only">{title}</RDialog.Description>
        )}
        <div className="mt-5">{children}</div>
      </RDialog.Content>
    </RDialog.Portal>
  );
}
