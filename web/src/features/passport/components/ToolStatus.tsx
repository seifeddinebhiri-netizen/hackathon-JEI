import type { AiTool } from '@/api/types';
import { Icon, StatusChip, Tooltip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { TOOL_STATUS_HELP, TOOL_STATUS_LABELS, TOOL_STATUS_TONES } from '../lib/labels';

export function ToolStatusChip({ status }: { status: AiTool['status'] }) {
  return (
    <Tooltip content={TOOL_STATUS_HELP}>
      <button
        type="button"
        className="inline-flex min-h-8 items-center"
        aria-label={`Statut du fournisseur : ${TOOL_STATUS_LABELS[status]}. ${TOOL_STATUS_HELP}`}
      >
        <StatusChip tone={TOOL_STATUS_TONES[status]}>{TOOL_STATUS_LABELS[status]}</StatusChip>
      </button>
    </Tooltip>
  );
}

/** Fiche d'un outil du catalogue : statut, note, source et date de vérification. */
export function ToolInfo({ tool }: { tool: AiTool }) {
  return (
    <div className="flex flex-col gap-2 border-2 border-line-light bg-paper p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">
          {tool.name} <span className="font-normal text-muted-on-light">· {tool.provider}</span>
        </p>
        <ToolStatusChip status={tool.status} />
      </div>
      {tool.note ? <p className="text-meta">{tool.note}</p> : null}
      <p className="flex flex-wrap items-center gap-x-3 text-meta text-muted-on-light">
        {tool.source_url ? (
          <a
            href={tool.source_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-1 underline underline-offset-4"
          >
            <Icon name="external" size={14} /> Source du fournisseur
          </a>
        ) : null}
        {tool.checked_at ? <span>Vérifié le {formatDate(tool.checked_at)}</span> : null}
      </p>
      {tool.reviewed === false ? (
        <p className="flex items-start gap-1.5 text-meta text-muted-on-light">
          <Icon name="info" size={14} className="mt-0.5 shrink-0" />
          Fiche non relue par une personne : elle vient d’une recherche automatique.
        </p>
      ) : null}
    </div>
  );
}
