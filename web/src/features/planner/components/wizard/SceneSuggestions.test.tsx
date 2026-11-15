import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/api';
import { buildDemoProject } from '@/api/mocks/data/project';
import { mockSuggestScenes } from '@/api/mocks/sceneSuggest';
import { sceneSuggestResultSchema } from '@/api/schemas';
import type { SceneSuggestion, WeatherDay } from '@/api/types';
import { SceneSuggestions } from './SceneSuggestions';
import { applySuggestion, buildSceneSuggestInput, cannotApply, describeChange } from './sceneSuggestionLogic';
import type { PlannerDraft } from './types';
import { weatherVerdict } from './weatherVerdict';

afterEach(() => vi.restoreAllMocks());

const project = buildDemoProject();
const draft: PlannerDraft = { scenes: project.scenes, locations: project.locations, people: project.people };

const sug = (over: Partial<SceneSuggestion>): SceneSuggestion => ({
  id: 'sug-1',
  scene_numbers: ['1'],
  kind: 'info_manquante',
  message: 'm',
  source: 's',
  change_setting: null,
  change_moment: null,
  change_decor: null,
  ...over,
});

describe('suggestions de tournage : logique', () => {
  it('applique une suggestion acceptée (INT/EXT, moment, décor), sans rien toucher d’autre', () => {
    const ext = applySuggestion(draft, sug({ kind: 'preciser_int_ext', change_setting: 'EXT' }));
    expect(ext.scenes[0].setting).toBe('EXT');
    expect(ext.scenes.slice(1)).toEqual(draft.scenes.slice(1));
    const soir = applySuggestion(draft, sug({ kind: 'preciser_moment', change_moment: 'heure_doree' }));
    expect(soir.scenes[0].moment).toBe('heure_doree');
    const regroup = applySuggestion(
      draft,
      sug({ kind: 'regrouper_decors', scene_numbers: ['6'], change_decor: 'médina : ruelle et café' }),
    );
    expect(regroup.scenes.find((s) => s.number === '6')!.location_id).toBe('loc-medina');
    // Une information manquante ne change rien
    expect(applySuggestion(draft, sug({}))).toBe(draft);
  });

  it('dit le changement en clair et repère une suggestion devenue impossible', () => {
    expect(describeChange(sug({ scene_numbers: ['2', '4'], change_setting: 'EXT' }))).toBe(
      'Scènes 2, 4 → Extérieur',
    );
    expect(describeChange(sug({ change_moment: 'heure_doree' }))).toBe('Scène 1 → Lumière du soir');
    expect(describeChange(sug({}))).toBeNull();
    expect(cannotApply(sug({ scene_numbers: ['99'] }), draft)).toBe('Cette scène n’existe plus.');
    expect(cannotApply(sug({ change_decor: 'Hôtel' }), draft)).toBe('Le décor « Hôtel » n’existe plus.');
  });

  it('le mock propose d’alléger une scène de nuit en extérieur, au bon format', () => {
    const r = mockSuggestScenes(buildSceneSuggestInput(project, draft));
    expect(sceneSuggestResultSchema.safeParse(r).success).toBe(true);
    const night = r.suggestions.find((s) => s.kind === 'alleger_scene')!;
    expect(night.scene_numbers).toEqual(['7']);
    expect(night.change_setting).toBeNull();
  });
});

describe('weatherVerdict', () => {
  const day = (date: string, rain: number | null): WeatherDay => ({
    date,
    rain_pct: rain,
    wind_kmh: rain === null ? null : 10,
    cloud_pct: rain === null ? null : 30,
    sunrise: '',
    sunset: '',
    golden_hour: { from: '', to: '' },
    forecast: rain === null ? 'hors_horizon' : 'prevision',
  });
  const days = [day('2026-11-22', 65), day('2026-11-23', 10), day('2026-11-24', 5), day('2026-11-25', null)];

  it('donne les meilleurs jours et propose des alternatives pour l’extérieur', () => {
    const v = weatherVerdict(days, true);
    expect(v.needsAlternatives).toBe(true);
    expect(v.sentence).toBe(
      'Pluie ou vent fort prévus 1 jour sur 3. Meilleurs jours pour les scènes en extérieur : lun. 23 nov., mar. 24 nov. Pour l’autre jour, la prévision arrive environ deux semaines avant.',
    );
  });

  it('ne s’inquiète pas quand tout est en intérieur', () => {
    const v = weatherVerdict(days, false);
    expect(v.needsAlternatives).toBe(false);
    expect(v.sentence).toBe(
      'Pluie ou vent prévus 1 jour, mais tout est en intérieur dans ce décor : pas de gêne.',
    );
  });
});

function Harness({ onDraft }: { onDraft: (d: PlannerDraft) => void }) {
  const [d, setD] = useState(draft);
  return (
    <SceneSuggestions
      project={project}
      draft={d}
      setDraft={(fn) =>
        setD((x) => {
          const next = fn(x);
          onDraft(next);
          return next;
        })
      }
    />
  );
}

describe('SceneSuggestions', () => {
  it('l’auteur accepte ou refuse chaque suggestion', async () => {
    const suggestions: SceneSuggestion[] = [
      sug({
        id: 'a',
        kind: 'preciser_moment',
        message: 'Le texte parle du soir.',
        change_moment: 'heure_doree',
      }),
      sug({ id: 'b', scene_numbers: ['3'], message: 'Qui est dans le café ?' }),
    ];
    const spy = vi
      .spyOn(api, 'suggestScenes')
      .mockResolvedValue({ status: 'Brouillon IA : à valider', suggestions, model: 'test' });
    const onDraft = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <Harness onDraft={onDraft} />
      </QueryClientProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Demander des suggestions' }));
    expect(await screen.findByText('2 suggestions à décider')).toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Brouillon IA : à valider')).toBeInTheDocument();

    const first = screen.getByText('Le texte parle du soir.').closest('li')!;
    expect(within(first).getByText('Changement proposé : Scène 1 → Lumière du soir')).toBeInTheDocument();
    await userEvent.click(within(first).getByRole('button', { name: 'Accepter le changement' }));
    expect(onDraft.mock.calls[0][0].scenes[0].moment).toBe('heure_doree');
    expect(within(first).getByText('Acceptée')).toBeInTheDocument();

    const second = screen.getByText('Qui est dans le café ?').closest('li')!;
    await userEvent.click(within(second).getByRole('button', { name: 'Refuser' }));
    expect(within(second).getByText('Refusée')).toBeInTheDocument();
    expect(onDraft).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Tu as décidé pour toutes les suggestions.')).toBeInTheDocument();
  });
});
