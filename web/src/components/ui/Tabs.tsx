import * as RTabs from '@radix-ui/react-tabs';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export const Tabs = RTabs.Root;

export function TabsList({ className, ...rest }: ComponentProps<typeof RTabs.List>) {
  return (
    <RTabs.List
      className={cn(
        'flex max-w-full flex-wrap gap-1 border-b-2 border-ink no-print md:flex-nowrap md:overflow-x-auto md:overflow-y-hidden',
        className,
      )}
      {...rest}
    />
  );
}

export function TabsTrigger({ className, ...rest }: ComponentProps<typeof RTabs.Trigger>) {
  return (
    <RTabs.Trigger
      className={cn(
        'eyebrow min-h-11 shrink-0 border-b-4 border-transparent px-4 py-3 text-muted-on-light',
        'hover:border-line-light hover:text-ink',
        'data-[state=active]:border-ink data-[state=active]:bg-white data-[state=active]:text-ink',
        className,
      )}
      {...rest}
    />
  );
}

export function TabsContent({ className, ...rest }: ComponentProps<typeof RTabs.Content>) {
  return <RTabs.Content className={cn('pt-6 focus-visible:outline-offset-4', className)} {...rest} />;
}
