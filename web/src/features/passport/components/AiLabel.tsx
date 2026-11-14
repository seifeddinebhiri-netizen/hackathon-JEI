import type { AiTool, DepartmentDeclaration } from '@/api/types';
import { Icon } from '@/components/ui';
import { cn } from '@/lib/cn';
import {
  classify,
  DEPARTMENT_LABELS,
  DEPARTMENTS,
  LABEL_DISCLAIMER,
  summarize,
  TOOL_STATUS_LABELS,
  USAGE_LABELS,
  type LabelClass,
} from '../lib/labels';

const CLASS_TEXT: Record<LabelClass, string> = {
  humain: '100 % humain',
  assiste: 'Assisté par IA',
  genere: 'Généré par IA',
};
const CLASS_ICON = { humain: 'user', assiste: 'users', genere: 'sparkle' } as const;

/**
 * L'Étiquette IA, au format d'une étiquette nutritionnelle : lisible d'un coup d'œil.
 * Noir sur blanc, traits épais, une ligne par département.
 */
export function AiLabel({
  filmTitle,
  director,
  badgeCode,
  declarations,
  tools = [],
  compact = false,
  showTools = !compact,
  className,
}: {
  filmTitle: string;
  director?: string;
  badgeCode?: string;
  declarations: DepartmentDeclaration[];
  tools?: AiTool[];
  compact?: boolean;
  showTools?: boolean;
  className?: string;
}) {
  const counts = summarize(declarations);
  const toolName = (d: DepartmentDeclaration) =>
    d.tool_id ? (tools.find((t) => t.id === d.tool_id)?.name ?? d.tool_id) : d.custom_tool;
  const toolStatus = (d: DepartmentDeclaration) => tools.find((t) => t.id === d.tool_id)?.status;

  return (
    <section
      aria-label={`Étiquette IA de ${filmTitle}`}
      className={cn('border-[3px] border-ink bg-white text-ink', compact ? 'p-3' : 'p-4 md:p-5', className)}
    >
      <header className="border-b-[10px] border-ink pb-2">
        <p className={cn('font-display leading-none font-bold tracking-tight', compact ? 'text-[26px]' : 'text-[36px]')}>
          Étiquette IA
        </p>
        <p className="mt-1 text-meta">
          <span className="font-semibold">{filmTitle}</span>
          {director ? ` · ${director}` : ''}
        </p>
      </header>

      <dl className="grid grid-cols-3 border-b-4 border-ink py-2 text-center">
        {(['humain', 'assiste', 'genere'] as const).map((k) => (
          <div key={k} className={cn(k !== 'humain' && 'border-l-2 border-ink')}>
            <dt className="eyebrow">{k === 'humain' ? 'Humain' : k === 'assiste' ? 'Assisté' : 'Généré'}</dt>
            <dd className={cn('font-display font-bold', compact ? 'text-[24px]' : 'text-[32px]')}>
              {counts[k]}
              <span className="text-meta font-normal">/8</span>
            </dd>
          </div>
        ))}
      </dl>

      <ul className="divide-y divide-ink/60">
        {DEPARTMENTS.map((dep) => {
          const d = declarations.find((x) => x.department === dep);
          const c = classify(d);
          return (
            <li key={dep} className={cn('flex items-center justify-between gap-3', compact ? 'py-1' : 'py-1.5')}>
              <span className={cn('font-semibold', compact ? 'text-meta' : 'text-body')}>{DEPARTMENT_LABELS[dep]}</span>
              <span className="flex items-center gap-1.5 text-right text-meta">
                {c ? (
                  <>
                    <Icon name={CLASS_ICON[c]} size={14} />
                    <span>
                      {c === 'humain' ? CLASS_TEXT.humain : d?.level ? USAGE_LABELS[d.level] : CLASS_TEXT[c]}
                      {showTools && d?.used_ai && toolName(d) ? (
                        <span className="block text-muted-on-light">
                          {toolName(d)}
                          {toolStatus(d) ? ` · ${TOOL_STATUS_LABELS[toolStatus(d)!]}` : ''}
                        </span>
                      ) : null}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-on-light">Non renseigné</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <footer className="mt-1 border-t-[6px] border-ink pt-2">
        {badgeCode ? (
          <p className="flex items-center justify-between gap-2">
            <span className="eyebrow">Passeport IA</span>
            <span className="font-mono text-label font-medium">{badgeCode}</span>
          </p>
        ) : null}
        <p className={cn('mt-1 text-muted-on-light', 'text-meta')}>{LABEL_DISCLAIMER}</p>
      </footer>
    </section>
  );
}
