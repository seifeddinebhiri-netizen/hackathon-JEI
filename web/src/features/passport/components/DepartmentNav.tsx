import type { DepartmentDeclaration } from '@/api/types';
import { Icon } from '@/components/ui';
import { cn } from '@/lib/cn';
import { declarationState, DEPARTMENT_LABELS, DEPARTMENTS, type DeclarationState } from '../lib/labels';

const STATE: Record<DeclarationState, { icon: 'user' | 'sparkle' | 'alert' | 'minus'; label: string }> = {
  vide: { icon: 'minus', label: 'à répondre' },
  humain: { icon: 'user', label: '100 % humain' },
  ia_complet: { icon: 'sparkle', label: 'IA déclarée' },
  ia_incomplet: { icon: 'alert', label: 'à compléter' },
};

export function DepartmentNav({
  declarations,
  current,
  onSelect,
}: {
  declarations: DepartmentDeclaration[];
  current: number;
  onSelect: (i: number) => void;
}) {
  return (
    <nav aria-label="Départements">
      <ol className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {DEPARTMENTS.map((dep, i) => {
          const st = declarationState(declarations.find((d) => d.department === dep));
          const active = i === current;
          return (
            <li key={dep}>
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'flex min-h-14 w-full items-center gap-2 border-2 px-2 py-1.5 text-left',
                  active ? 'border-ink bg-ink text-paper' : 'border-line-light bg-white hover:border-ink',
                  !active && st === 'ia_incomplet' && 'border-warn-fg',
                )}
              >
                <Icon
                  name={STATE[st].icon}
                  size={16}
                  className={cn('shrink-0', !active && st === 'ia_incomplet' && 'text-warn-fg')}
                />
                <span className="min-w-0">
                  <span className="block truncate text-meta font-semibold">{DEPARTMENT_LABELS[dep]}</span>
                  <span
                    className={cn('block text-label', active ? 'text-muted-on-dark' : 'text-muted-on-light')}
                  >
                    {STATE[st].label}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
