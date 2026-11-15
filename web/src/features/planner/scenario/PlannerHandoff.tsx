import { useState } from 'react';
import { Button, ButtonLink, Field, Input } from '@/components/ui';
import type { ParseScreenplayResult, SceneMoment } from '@/api/types';
import { analysisSchema } from './api';
import { HANDOFF_KEY } from './storage';
import { localId } from '../lib/ids';

export function PlannerHandoff({ onApply }: { onApply: (result: ParseScreenplayResult) => void }) {
  const [analysis, setAnalysis] = useState(() => {
    try {
      return analysisSchema.parse(JSON.parse(sessionStorage.getItem(HANDOFF_KEY) ?? 'null'));
    } catch {
      return null;
    }
  });
  const [hours, setHours] = useState<Record<number, number>>({});
  if (!analysis)
    return (
      <ButtonLink to="/planner/scenario" variant="secondary">
        Analyser un scénario avec Encadré
      </ButtonLink>
    );
  const incomplete = analysis.scenes.some(
    (s) => s.setting === 'UNKNOWN' || s.time_of_day === 'UNKNOWN' || !s.location.trim(),
  );
  return (
    <section className="flex flex-col gap-4 border-2 border-ink bg-gold-soft p-5">
      <h2 className="text-h2">Transférer « {analysis.title} » au projet</h2>
      <p>
        {analysis.simulated ? 'Exemple simulé. ' : ''}Le transfert ajoute les scènes à la suite des scènes
        existantes et déclenche la sauvegarde habituelle du projet. Le texte original reste dans la session de
        cet onglet.
      </p>
      <p>
        Indique tes estimations de temps de tournage (heures). Ces valeurs ne sont pas produites par l’IA. Le
        crépuscule est transféré comme « heure dorée », à ajuster dans le planner.
      </p>
      {incomplete && (
        <p role="alert">Complète les lieux, INT/EXT et moments inconnus dans l’analyse avant le transfert.</p>
      )}
      {analysis.scenes.map((s) => (
        <Field key={s.number} label={`Heures de tournage · scène ${s.number}`}>
          <Input
            type="number"
            min="0.25"
            max="100"
            step="0.25"
            value={hours[s.number] ?? ''}
            onChange={(e) => setHours((h) => ({ ...h, [s.number]: Number(e.target.value) }))}
          />
        </Field>
      ))}
      <Button
        disabled={
          incomplete || analysis.scenes.some((s) => !(hours[s.number] >= 0.25 && hours[s.number] <= 100))
        }
        onClick={() => {
          const locations = [...new Set(analysis.scenes.map((s) => s.location.trim()))].map((name) => ({
            id: localId('loc'),
            name,
            address: '',
            forbidden_days: [],
            permit: 'a_demander' as const,
          }));
          const moments: Record<string, SceneMoment> = {
            DAY: 'jour',
            NIGHT: 'nuit',
            DAWN: 'aube',
            DUSK: 'heure_doree',
          };
          onApply({
            locations,
            characters: analysis.characters.map((c) => c.name),
            warnings: ['Adresses, autorisations et durées à vérifier avant de générer le planning.'],
            scenes: analysis.scenes.map((s) => ({
              id: localId('sc'),
              number: String(s.number),
              title: s.heading,
              setting: s.setting as 'INT' | 'EXT',
              moment: moments[s.time_of_day],
              location_id: locations.find((l) => l.name === s.location.trim())!.id,
              characters: s.characters.filter(Boolean),
              estimated_hours: hours[s.number],
              summary: s.summary,
              source: 'import_ia',
              validated: true,
            })),
          });
          sessionStorage.removeItem(HANDOFF_KEY);
          setAnalysis(null);
        }}
      >
        Ajouter ces scènes au projet
      </Button>
      <ButtonLink to="/planner/scenario" variant="secondary">
        Revoir l’analyse
      </ButtonLink>
    </section>
  );
}
