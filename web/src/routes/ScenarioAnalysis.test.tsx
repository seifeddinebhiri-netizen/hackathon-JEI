import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ScenarioAnalysis from './ScenarioAnalysis';
import { DEMO } from '@/features/planner/scenario/demo';
import { analyzeScenario } from '@/features/planner/scenario/api';
import { HANDOFF_KEY, SESSION_KEY } from '@/features/planner/scenario/storage';

vi.mock('@/features/planner/scenario/api', async (original) => ({
  ...(await original<typeof import('@/features/planner/scenario/api')>()),
  analyzeScenario: vi.fn(),
}));
function mount() {
  return render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient()}>
        <ScenarioAnalysis />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
});
afterEach(cleanup);

describe('Screenplay workflow', () => {
  it('validates input without transmitting content', () => {
    mount();
    fireEvent.click(screen.getByText('Analyser mon scénario'));
    expect(screen.getByText('Indique un titre.')).toBeInTheDocument();
    expect(analyzeScenario).not.toHaveBeenCalled();
  });
  it('renders real results, edits them, validates and prepares explicit handoff', async () => {
    vi.mocked(analyzeScenario).mockResolvedValue({ ...structuredClone(DEMO), simulated: false });
    mount();
    fireEvent.click(screen.getByText('Charger l’exemple'));
    expect(analyzeScenario).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Analyser mon scénario'));
    expect(await screen.findByText('Brouillon IA : à valider')).toBeInTheDocument();
    expect(screen.getByText('1. INT. CAFÉ – JOUR')).toBeInTheDocument();
    expect(screen.getByText('Continuer vers la planification')).toBeDisabled();
    fireEvent.click(screen.getByText('Modifier la scène 1'));
    fireEvent.change(screen.getByLabelText('Lieu'), { target: { value: 'Café corrigé' } });
    fireEvent.click(screen.getByText('Terminer'));
    expect(screen.getByText('Lieu : Café corrigé')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Confirmer l’analyse'));
    expect(screen.getByText('Analyse validée par le cinéaste')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Continuer vers la planification'));
    expect(JSON.parse(sessionStorage.getItem(HANDOFF_KEY)!).scenes[0].location).toBe('Café corrigé');
    const stored = JSON.parse(sessionStorage.getItem(SESSION_KEY)!);
    expect(stored.content).toContain('Un café, s’il vous plaît.'.replace('’', "'"));
  });
  it('shows failures without silently switching to demo', async () => {
    vi.mocked(analyzeScenario).mockRejectedValue(new Error('Fournisseur indisponible'));
    mount();
    fireEvent.click(screen.getByText('Charger l’exemple'));
    fireEvent.click(screen.getByText('Analyser mon scénario'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Fournisseur indisponible');
    expect(screen.queryByText('Brouillon IA : à valider')).not.toBeInTheDocument();
  });
  it('labels demo, revokes confirmation after editing and clears session', async () => {
    mount();
    fireEvent.click(screen.getByText('Mode démo · données simulées'));
    expect(screen.getByText(/Mode démo — données simulées/)).toBeInTheDocument();
    expect(analyzeScenario).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Confirmer l’analyse'));
    fireEvent.change(screen.getByLabelText('Description de YACINE'), { target: { value: 'Correction' } });
    expect(screen.getByText('Brouillon IA : à valider')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Effacer ma session'));
    await waitFor(() => expect(screen.getByLabelText(/Texte du scénario/)).toHaveValue(''));
    expect(JSON.parse(sessionStorage.getItem(SESSION_KEY)!).analysis).toBeNull();
  });
});
