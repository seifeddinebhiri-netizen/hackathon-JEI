import type { ReactNode } from 'react';
import { BabaJamil, type BabaJamilPose } from '@/components/BabaJamil';
import { Icon, Perforations } from '@/components/ui';

/** Mise en page commune des écrans de compte : bandeau sombre à gauche, formulaire à droite. */
export function AuthPage({
  eyebrow,
  title,
  lead,
  pose,
  bulle,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  lead: string;
  pose: BabaJamilPose;
  bulle: string;
  children: ReactNode;
}) {
  return (
    <div className="grid lg:min-h-[calc(100dvh-64px)] lg:grid-cols-12">
      <aside className="flex flex-col justify-between bg-ink text-paper lg:col-span-5">
        <div className="container-pp py-12 lg:px-12 lg:py-16 xl:px-16">
          <p className="eyebrow text-gold">{eyebrow}</p>
          <h1 className="mt-4 text-[44px] leading-[0.95] md:text-page">{title}</h1>
          <p className="mt-6 max-w-md text-lead text-muted-on-dark">{lead}</p>
          <BabaJamil pose={pose} taille="m" bulle={bulle} className="mt-8" />
        </div>
        <Perforations className="hidden lg:flex" />
      </aside>

      <div className="container-pp py-12 lg:col-span-7 lg:max-w-2xl lg:px-12 lg:py-16 xl:px-16">
        {children}
      </div>
    </div>
  );
}

export function AuthError({ children }: { children: string }) {
  return (
    <p
      role="alert"
      className="flex items-center gap-2 border-2 border-bad-fg bg-bad-bg p-3 font-semibold text-bad-fg"
    >
      <Icon name="alert" size={18} />
      {children}
    </p>
  );
}

export function AuthNotice({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      className="flex items-start gap-2 border-2 border-ok-fg bg-ok-bg p-3 font-semibold text-ok-fg"
    >
      <Icon name="check" size={18} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
