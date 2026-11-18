import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCameraSettings } from './useCameraSettings';

function fakeStream(caps: Record<string, unknown>, settings: Record<string, unknown> = {}) {
  const applyConstraints = vi.fn().mockResolvedValue(undefined);
  const track = { getCapabilities: () => caps, getSettings: () => settings, applyConstraints };
  return { stream: { getVideoTracks: () => [track] } as unknown as MediaStream, applyConstraints };
}
const hook = (stream: MediaStream | null) => renderHook(() => useCameraSettings(stream));

describe('réglages de la caméra', () => {
  it('aucun réglage sans caméra ou si le navigateur n’en expose pas (Safari iPhone)', () => {
    expect(hook(null).result.current.items).toEqual([]);
    const { stream } = fakeStream({ width: { min: 1, max: 1920 }, frameRate: { min: 1, max: 30 } });
    expect(hook(stream).result.current.items).toEqual([]);
  });

  it('liste ceux qui existent, avec leur valeur actuelle, et nomme ceux qui manquent', () => {
    const { stream } = fakeStream(
      { exposureCompensation: { min: -3, max: 3, step: 0.5 }, zoom: { min: 1, max: 5, step: 0.1 } },
      { exposureCompensation: 1 },
    );
    const { items, missing, exposed } = hook(stream).result.current;
    expect(items.map((i) => [i.key, i.kind === 'range' ? i.value : null])).toEqual([
      ['exposureCompensation', 1],
      ['zoom', 1],
    ]);
    expect(missing).toEqual(
      expect.arrayContaining(['Contraste', 'ISO', 'Lampe', 'Verrouiller l’exposition']),
    );
    expect(exposed).toEqual(['exposureCompensation', 'zoom']);
  });

  it('propose lampe et verrous seulement s’ils sont annoncés', () => {
    const { stream } = fakeStream({
      torch: true,
      exposureMode: ['continuous', 'manual'],
      focusMode: ['continuous'],
    });
    const keys = hook(stream).result.current.items.map((i) => i.key);
    expect(keys).toEqual(['exposureMode', 'torch']);
  });

  it('applique un curseur sur la vraie caméra', () => {
    const { stream, applyConstraints } = fakeStream({ brightness: { min: 0, max: 255, step: 1 } });
    const { result } = hook(stream);
    act(() => result.current.setRange('brightness', 120));
    expect(applyConstraints).toHaveBeenCalledWith({ advanced: [{ brightness: 120 }] });
    expect(result.current.items[0]).toMatchObject({ value: 120 });
  });

  it('régler l’ISO passe d’abord l’exposition en manuel', () => {
    const { stream, applyConstraints } = fakeStream({
      iso: { min: 100, max: 1600, step: 50 },
      exposureMode: ['continuous', 'manual'],
    });
    const { result } = hook(stream);
    act(() => result.current.setRange('iso', 400));
    expect(applyConstraints).toHaveBeenCalledWith({ advanced: [{ exposureMode: 'manual', iso: 400 }] });
  });

  it('interrupteurs : lampe et verrouillage, puis réinitialisation en automatique', () => {
    const { stream, applyConstraints } = fakeStream({ torch: true, focusMode: ['continuous', 'manual'] });
    const { result } = hook(stream);
    act(() => result.current.setSwitch('torch', true));
    expect(applyConstraints).toHaveBeenLastCalledWith({ advanced: [{ torch: true }] });
    act(() => result.current.setSwitch('focusMode', true));
    expect(applyConstraints).toHaveBeenLastCalledWith({ advanced: [{ focusMode: 'manual' }] });
    act(() => result.current.reset());
    expect(applyConstraints).toHaveBeenLastCalledWith({
      advanced: [{ focusMode: 'continuous', torch: false }],
    });
  });
});
