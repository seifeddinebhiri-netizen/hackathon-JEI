import { useState } from 'react';
import type { Project, SceneSuggestion, SceneSuggestResult } from '@/api/types';
import { AiDraftBadge, Button, Icon, Skeleton, StatusChip } from '@/components/ui';
import {
  cachedSceneSuggestions,
  saveSuggestionDecision,
  useSuggestScenes,
  type SuggestionDecision,
} from '../../hooks/usePlanner';
import {
  applySuggestion,
  buildSceneSuggestInput,
  cannotApply,
  describeChange,
  SUGGESTION_KIND_LABELS,
} from './sceneSuggestionLogic';
import type { DraftSetter, PlannerDraft } from './types';

function SuggestionCard({
  s,
  draft,
  decision,
  onDecide,
}: {
  s: SceneSuggestion;
  draft: PlannerDraft;
  decision?: SuggestionDecision;
  onDecide: (s: SceneSuggestion, d: SuggestionDecision | undefined) => void;
}) {
  const change = describeChange(s);
  const blocked = decision ? null : cannotApply(s, draft);
  return (
    <li className="flex flex-col gap-2 border-2 border-ink bg-white p-4">
      <p className="flex flex-wrap items-center gap-2">
        <span className="text-meta font-semibold text-muted-on-light">
          {SUGGESTION_KIND_LABELS[s.kind]} · {s.scene_numbers.length > 1 ? 'scènes' : 'scène'}{' '}
          {s.scene_numbers.join(', ')}
        </span>
        {decision === 'acceptee' ? (
          <StatusChip tone="ok" icon="check">
            Acceptée
          </StatusChip>
        ) : decision === 'refusee' ? (
          <StatusChip tone="neutral" icon="x">
            Refusée
          </StatusChip>
        ) : null}
      </p>
      <p>{s.message}</p>
      {s.source ? (
        <p className="text-meta text-muted-on-light">
          D’après ton texte : <q>{s.source}</q>
        </p>
      ) : null}
      {change ? <p className="text-meta font-semibold">Changement proposé : {change}</p> : null}
      {blocked ? <p className="text-meta text-muted-on-light">{blocked}</p> : null}
      {!decision ? (
        <p className="flex flex-wrap gap-2">
          <Button size="sm" icon="check" disabled={!!blocked} onClick={() => onDecide(s, 'acceptee')}>
            {change ? 'Accepter le changement' : 'C’est noté'}
          </Button>
          <Button size="sm" variant="secondary" icon="x" onClick={() => onDecide(s, 'refusee')}>
            Refuser
          </Button>
        </p>
      ) : decision === 'refusee' ? (
        <Button size="sm" variant="ghost" className="self-start" onClick={() => onDecide(s, undefined)}>
          Revenir sur ce refus
        </Button>
      ) : change ? (
        <p className="text-meta text-muted-on-light">
          La scène a été modifiée : tu peux la corriger plus bas.
        </p>
      ) : null}
    </li>
  );
}

/**
 * Suggestions de l'IA pour le TOURNAGE, à valider par l'auteur. L'IA ne réécrit jamais l'histoire :
 * elle propose de préciser INT/EXT ou le moment, de regrouper des décors, d'alléger une scène, ou
 * signale une information manquante. Une suggestion acceptée modifie la scène dans le brouillon.
 */
export function SceneSuggestions({
  project,
  draft,
  setDraft,
}: {
  project: Project;
  draft: PlannerDraft;
  setDraft: DraftSetter;
}) {
  const suggest = useSuggestScenes();
  const input = buildSceneSuggestInput(project, draft);
  const cached = cachedSceneSuggestions(project.id, input);
  const [result, setResult] = useState<SceneSuggestResult | undefined>(cached?.result);
  const [decisions, setDecisions] = useState<Record<string, SuggestionDecision>>(cached?.decisions ?? {});

  const run = () =>
    suggest.mutate(
      { projectId: project.id, input },
      {
        onSuccess: (r) => {
          setResult(r);
          setDecisions(cachedSceneSuggestions(project.id, input)?.decisions ?? {});
        },
      },
    );

  const decide = (s: SceneSuggestion, d: SuggestionDecision | undefined) => {
    if (d === 'acceptee') setDraft((x) => applySuggestion(x, s));
    setDecisions((prev) => {
      const next = { ...prev };
      if (d) next[s.id] = d;
      else delete next[s.id];
      return next;
    });
    if (d) saveSuggestionDecision(project.id, s.id, d);
  };

  if (!draft.scenes.length) return null;
  const open = result?.suggestions.filter((s) => !decisions[s.id]).length ?? 0;

  return (
    <section
      aria-labelledby="suggestions-titre"
      className="flex flex-col gap-4 border-2 border-ink bg-gold-soft/40 p-4 md:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="suggestions-titre" className="text-h3">
            Suggestions pour le tournage
          </h2>
          {result ? <AiDraftBadge validated={!open} /> : null}
        </div>
        {result && !suggest.isPending ? (
          <Button size="sm" variant="ghost" icon="sparkle" onClick={run}>
            Relire mes scènes
          </Button>
        ) : null}
      </div>
      <p className="max-w-prose text-meta">
        L’IA relit tes scènes et propose de préciser ou de simplifier le tournage. Elle ne réécrit jamais ton
        histoire, tes dialogues ni tes personnages : tu acceptes ou tu refuses chaque suggestion.
      </p>

      {!result && !suggest.isPending ? (
        <Button icon="sparkle" className="self-start" onClick={run}>
          Demander des suggestions
        </Button>
      ) : null}

      {suggest.isPending ? (
        <div role="status" className="flex flex-col gap-3">
          <p className="flex items-center gap-2 font-semibold">
            <Icon name="sparkle" size={18} /> L’IA relit tes scènes…
          </p>
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : null}

      {suggest.isError ? (
        <p role="alert" className="flex flex-wrap items-center gap-2 text-meta font-semibold text-bad-fg">
          <Icon name="alert" size={16} /> {suggest.error.message}
          <Button size="sm" variant="ghost" onClick={run}>
            Réessayer
          </Button>
        </p>
      ) : null}

      {result && !suggest.isPending ? (
        result.suggestions.length ? (
          <>
            <p className="text-meta font-semibold">
              {open
                ? `${open} suggestion${open > 1 ? 's' : ''} à décider`
                : 'Tu as décidé pour toutes les suggestions.'}
            </p>
            <ul className="flex flex-col gap-3">
              {result.suggestions.map((s) => (
                <SuggestionCard key={s.id} s={s} draft={draft} decision={decisions[s.id]} onDecide={decide} />
              ))}
            </ul>
          </>
        ) : (
          <p className="flex items-center gap-2 text-meta font-semibold text-ok-fg">
            <Icon name="check" size={16} /> Rien à signaler : tes scènes sont claires pour préparer le
            tournage.
          </p>
        )
      ) : null}
    </section>
  );
}
