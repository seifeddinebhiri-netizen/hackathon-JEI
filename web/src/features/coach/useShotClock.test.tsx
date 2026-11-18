import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useShotClock } from './useShotClock';

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe('décompte d’un plan en mouvement', () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'],
    });
  });
  afterEach(() => vi.useRealTimers());

  it('au repos tant que rien ne démarre', () => {
    const { result } = renderHook(() => useShotClock(10, null));
    expect(result.current.phase).toBe('idle');
    expect(result.current.elapsed).toBeNull();
    expect(result.current.getElapsed()).toBeNull();
  });

  it('démarre avec l’enregistrement et compte les secondes depuis son départ précis', () => {
    const { result, rerender } = renderHook(({ rec }: { rec: number | null }) => useShotClock(10, rec), {
      initialProps: { rec: null as number | null },
    });
    advance(5000); // du temps passe avant d'appuyer sur enregistrer : il ne compte pas
    rerender({ rec: performance.now() });
    expect(result.current.phase).toBe('running');
    advance(3000);
    expect(result.current.getElapsed()).toBeCloseTo(3, 1);
    expect(result.current.elapsed).toBeGreaterThanOrEqual(2.8);
    expect(result.current.rehearsing).toBe(false);
  });

  it('finit à la durée du plan', () => {
    const start = performance.now(); // l'instant de départ ne change pas d'un rendu à l'autre
    const { result } = renderHook(() => useShotClock(4, start));
    advance(3000);
    expect(result.current.phase).toBe('running');
    advance(1500);
    expect(result.current.phase).toBe('finished');
  });

  it('répétition : démarre sans enregistrer, et s’arrête à la demande', () => {
    const { result } = renderHook(() => useShotClock(10, null));
    act(() => result.current.startRehearsal());
    expect(result.current.phase).toBe('running');
    expect(result.current.rehearsing).toBe(true);
    advance(2000);
    expect(result.current.getElapsed()).toBeCloseTo(2, 1);
    act(() => result.current.stopRehearsal());
    expect(result.current.phase).toBe('idle');
  });

  it('plan fixe (sans durée) : jamais de décompte', () => {
    const { result } = renderHook(() => useShotClock(null, performance.now()));
    act(() => result.current.startRehearsal());
    expect(result.current.phase).toBe('idle');
  });
});
