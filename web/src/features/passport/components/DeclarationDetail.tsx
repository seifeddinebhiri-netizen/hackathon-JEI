import type { AiTool, DepartmentDeclaration } from '@/api/types';
import { Icon, StatusChip } from '@/components/ui';
import { DEPARTMENT_LABELS, DEPARTMENTS, USAGE_HINTS, USAGE_LABELS } from '../lib/labels';
import { ToolInfo } from './ToolStatus';

/** Détail par département pour la page publique de vérification. */
export function DeclarationDetail({
  declarations,
  tools,
}: {
  declarations: DepartmentDeclaration[];
  tools: AiTool[];
}) {
  return (
    <ol className="flex flex-col divide-y-2 divide-line-light border-y-2 border-ink">
      {DEPARTMENTS.map((dep) => {
        const d = declarations.find((x) => x.department === dep);
        const tool = d?.tool_id ? tools.find((t) => t.id === d.tool_id) : undefined;
        return (
          <li key={dep} className="print-avoid grid grid-cols-1 gap-3 py-5 md:grid-cols-12">
            <div className="md:col-span-4">
              <h3 className="text-h3">{DEPARTMENT_LABELS[dep]}</h3>
              <div className="mt-2">
                {!d ? (
                  <StatusChip tone="neutral" icon="minus">
                    Non renseigné
                  </StatusChip>
                ) : !d.used_ai ? (
                  <StatusChip tone="neutral" icon="user">
                    Aucune IA déclarée
                  </StatusChip>
                ) : (
                  <StatusChip tone="gold" icon="sparkle">
                    {d.level ? USAGE_LABELS[d.level] : 'IA déclarée'}
                  </StatusChip>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-3 md:col-span-8">
              {d?.used_ai ? (
                <>
                  {d.level ? <p className="text-meta text-muted-on-light">{USAGE_HINTS[d.level]}</p> : null}
                  <p>
                    <strong>Ce que l’IA a fait : </strong>
                    {d.what || '—'}
                  </p>
                  {tool ? (
                    <ToolInfo tool={tool} />
                  ) : d.custom_tool ? (
                    <div className="border-2 border-line-light bg-paper p-3">
                      <p className="font-semibold">{d.custom_tool}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-meta">
                        <StatusChip tone="bad">Non divulgué</StatusChip> Outil absent du catalogue : aucune
                        documentation publique vérifiée.
                      </p>
                    </div>
                  ) : null}
                </>
              ) : null}
              {d?.human_decisions ? (
                <p className="flex items-start gap-2">
                  <Icon name="user" size={18} className="mt-0.5 shrink-0" />
                  <span>
                    <strong>{d.used_ai ? 'Décidé par l’équipe : ' : 'Travail humain : '}</strong>
                    {d.human_decisions}
                  </span>
                </p>
              ) : null}
              {!d?.used_ai && !d?.human_decisions ? (
                <p className="text-meta text-muted-on-light">
                  {d ? 'Aucun détail fourni.' : 'L’équipe n’a pas encore répondu pour ce département.'}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
