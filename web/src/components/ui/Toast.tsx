import * as RToast from '@radix-ui/react-toast';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from './Icon';

import { ToastContext as Ctx, type ToastApi, type ToastInput, type ToastTone } from './toast-context';

type ToastItem = ToastInput & { id: number; tone: ToastTone };

const tones: Record<ToastTone, string> = {
  ok: 'border-ok-fg bg-ok-bg text-ok-fg',
  bad: 'border-bad-fg bg-bad-bg text-bad-fg',
  info: 'border-ink bg-white text-ink',
};
const icons = { ok: 'check', bad: 'alert', info: 'info' } as const;

export function Toaster({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const toast = useCallback<ToastApi['toast']>((t) => {
    setItems((xs) => [...xs, { ...t, id: Date.now() + Math.random(), tone: t.tone ?? 'info' }]);
  }, []);
  const api = useMemo(() => ({ toast }), [toast]);
  return (
    <Ctx.Provider value={api}>
      <RToast.Provider swipeDirection="right" label="Notification">
        {children}
        {items.map((t) => (
          <RToast.Root
            key={t.id}
            duration={t.duration ?? 5000}
            onOpenChange={(open) => !open && setItems((xs) => xs.filter((x) => x.id !== t.id))}
            className={cn('flex items-center gap-3 border-2 p-4 shadow-hard-sm', tones[t.tone])}
          >
            <Icon name={icons[t.tone]} className="mt-0.5 shrink-0" />
            <div className="flex-1">
              <RToast.Title className="font-semibold">{t.title}</RToast.Title>
              {t.description ? (
                <RToast.Description className="text-meta">{t.description}</RToast.Description>
              ) : null}
            </div>
            {t.action ? (
              <RToast.Action
                altText={t.action.label}
                onClick={t.action.onClick}
                className="min-h-11 shrink-0 border-2 border-current px-3 font-semibold hover:bg-ink/5"
              >
                {t.action.label}
              </RToast.Action>
            ) : null}
            <RToast.Close aria-label="Fermer" className="grid size-11 shrink-0 place-items-center">
              <Icon name="x" size={16} />
            </RToast.Close>
          </RToast.Root>
        ))}
        <RToast.Viewport className="fixed right-4 bottom-4 z-[60] flex w-[min(380px,calc(100vw-32px))] flex-col gap-2 outline-none" />
      </RToast.Provider>
    </Ctx.Provider>
  );
}
