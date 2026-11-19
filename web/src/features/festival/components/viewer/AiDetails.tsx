import type { SubtitleDraft } from '@/api/types';
import { Button, Icon } from '@/components/ui';
import { toolName } from '../../lib/viewer';

/** Panneau repliable sous la frise : ce que l'IA a fait (lu dans `processing`) et refaire le brouillon. */
export function AiDetails({
  draft,
  director,
  festivalLabel,
  onReplace,
}: {
  draft: SubtitleDraft;
  director: string;
  festivalLabel?: string;
  onReplace: () => void;
}) {
  const glossary = new Set(draft.lines.flatMap((l) => l.glossary_used ?? []));
  const ruled = draft.lines.filter((l) => l.warnings?.length).length;
  const p = draft.processing;
  return (
    <details className="group border-2 border-line-light bg-white">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 p-4 font-semibold [&::-webkit-details-marker]:hidden">
        <span>Ce que l’IA a fait · Refaire le brouillon</span>
        <Icon name="chevronDown" size={18} className="shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-4 border-t-2 border-line-light p-4 md:p-5">
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            <strong>Transcription</strong> de la derja
            {p ? ` avec ${p.transcriber.split('/')[0]} (${toolName(p.transcriber)})` : ''}.
          </li>
          <li>
            <strong>Traduction</strong> FR et EN{p ? ` avec ${toolName(p.translator)}` : ''} et le glossaire
            derja : {glossary.size} expression{glossary.size > 1 ? 's' : ''} reconnue
            {glossary.size > 1 ? 's' : ''}.
          </li>
          <li>
            <strong>Règles de sous-titrage</strong> vérifiées par le code : {ruled} ligne
            {ruled > 1 ? 's' : ''} à revoir.
          </li>
        </ul>
        <p className="text-meta text-muted-on-light">
          L’audio a été supprimé du serveur après la transcription. Le Passeport IA pourra indiquer : «
          sous-titres assistés par IA, relus par {director} ».
        </p>
        {festivalLabel ? (
          <p className="text-meta text-muted-on-light">
            Une seule relecture sert à tous tes dossiers qui demandent ces sous-titres (dont {festivalLabel}).
          </p>
        ) : null}
        <Button variant="secondary" icon="upload" onClick={onReplace} className="self-start">
          Refaire le brouillon depuis ma vidéo
        </Button>
      </div>
    </details>
  );
}
