import { Fragment } from 'react';
import { Icon } from '@/components/ui';

const STEPS = ['Planifier', 'Tourner', 'Déclarer', 'Diffuser'];

/** Bande or : les 4 étapes en une ligne. */
export function StepsBand() {
  return (
    <div className="on-gold bg-gold text-ink">
      <ol className="container-pp flex flex-wrap items-center justify-center gap-x-4 gap-y-2 py-5 md:justify-between">
        {STEPS.map((s, i) => (
          <Fragment key={s}>
            <li className="flex items-center gap-3">
              <span className="grid size-8 place-items-center bg-ink font-mono text-label text-gold">
                {i + 1}
              </span>
              <span className="font-display text-[22px] font-bold md:text-[28px]">{s}</span>
            </li>
            {i < STEPS.length - 1 ? (
              <li aria-hidden className="hidden md:block">
                <Icon name="arrowRight" size={28} />
              </li>
            ) : null}
          </Fragment>
        ))}
      </ol>
    </div>
  );
}
