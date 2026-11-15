import { useState } from 'react';
import { Button, ButtonLink } from '@/components/ui';
import type { DraftSetter, PlannerDraft } from '../components/wizard/types';
import { readChoices } from './storage';
import { localTime } from './solar';
import { applyScoutChoice, matchesChoice } from './handoff';

export function ScoutHandoff({ draft, setDraft }: { draft: PlannerDraft; setDraft: DraftSetter }) {
  const [choices] = useState(readChoices);
  const [applied, setApplied] = useState<string[]>([]);
  return (
    <section className="flex flex-col gap-3 border-2 border-ink bg-gold-soft p-5">
      <ButtonLink to="/planner/reperage" variant="secondary">
        Repérer des lieux et comparer la météo
      </ButtonLink>
      {choices.map((c) => {
        const match = draft.scenes.some((s) => matchesChoice(s, c));
        return (
          <div key={c.scene_id}>
            <p>
              {c.scene_heading} → {c.location.name} · {c.date} · {localTime(c.slot.start, c.timezone)} (
              {c.timezone})
            </p>
            <Button
              disabled={!match || applied.includes(c.scene_id)}
              onClick={() => {
                setDraft((d) => applyScoutChoice(d, c));
                setApplied((ids) => [...ids, c.scene_id]);
              }}
            >
              {applied.includes(c.scene_id)
                ? 'Repérage appliqué'
                : `Associer ce lieu · scène ${c.scene_number}`}
            </Button>
            {!match && (
              <p className="text-meta">
                Ajoute d’abord cette scène au projet (numéro et en-tête identiques).
              </p>
            )}
          </div>
        );
      })}
      {!!choices.length && (
        <p className="text-meta">
          La date et l’heure restent une préférence dans les notes du lieu. Elles ne modifient pas
          automatiquement le calendrier existant.
        </p>
      )}
    </section>
  );
}
