import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { PlannerHandoff } from './PlannerHandoff';
import { DEMO } from './demo';
import { HANDOFF_KEY } from './storage';

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

it('requires human shooting estimates before transferring scenes', () => {
  sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(DEMO));
  const apply = vi.fn();
  render(
    <MemoryRouter>
      <PlannerHandoff onApply={apply} />
    </MemoryRouter>,
  );
  const add = screen.getByText('Ajouter ces scènes au projet');
  expect(add).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Heures de tournage · scène 1'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Heures de tournage · scène 2'), { target: { value: '3' } });
  fireEvent.click(add);
  expect(apply).toHaveBeenCalledOnce();
  const result = apply.mock.calls[0][0];
  expect(result.scenes.map((s: { estimated_hours: number }) => s.estimated_hours)).toEqual([2, 3]);
  expect(result.locations.every((l: { address: string }) => l.address === '')).toBe(true);
  expect(sessionStorage.getItem(HANDOFF_KEY)).toBeNull();
});
