import { useCallback, useMemo, useState } from 'react';

/**
 * Réglages de la vraie caméra tels que le navigateur les expose (MediaStreamTrack.getCapabilities).
 * Chaque appareil en propose un nombre différent : Chrome sur Android en offre souvent quelques-uns
 * (parfois seulement le zoom), Safari sur iPhone n'en expose aucun. On n'affiche que ce qui existe
 * et on liste le reste comme « non proposé ».
 */
export type RangeKey =
  | 'exposureCompensation'
  | 'brightness'
  | 'contrast'
  | 'saturation'
  | 'sharpness'
  | 'colorTemperature'
  | 'iso'
  | 'exposureTime'
  | 'focusDistance'
  | 'zoom';
export type LockKey = 'exposureMode' | 'whiteBalanceMode' | 'focusMode';
export type SettingKey = RangeKey | LockKey | 'torch';

export const RANGE_LABELS: Record<RangeKey, string> = {
  exposureCompensation: 'Exposition',
  brightness: 'Luminosité',
  contrast: 'Contraste',
  saturation: 'Saturation',
  sharpness: 'Netteté',
  colorTemperature: 'Température de couleur',
  iso: 'ISO',
  exposureTime: 'Temps d’exposition',
  focusDistance: 'Mise au point (distance)',
  zoom: 'Zoom',
};
export const LOCK_LABELS: Record<LockKey, string> = {
  exposureMode: 'Verrouiller l’exposition',
  whiteBalanceMode: 'Verrouiller la balance des blancs',
  focusMode: 'Verrouiller la mise au point',
};
const TORCH_LABEL = 'Lampe';

/** Régler ces valeurs exige de passer le mode correspondant en « manuel ». */
const NEEDS_MANUAL: Partial<Record<RangeKey, LockKey>> = {
  colorTemperature: 'whiteBalanceMode',
  iso: 'exposureMode',
  exposureTime: 'exposureMode',
  focusDistance: 'focusMode',
};

type Range = { min: number; max: number; step?: number };
type Caps = Partial<Record<RangeKey, Range>> & Partial<Record<LockKey, string[]>> & { torch?: boolean };
type Current = Partial<Record<RangeKey, number>> & Partial<Record<LockKey, string>> & { torch?: boolean };

export type RangeItem = {
  kind: 'range';
  key: RangeKey;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
};
export type SwitchItem = { kind: 'switch'; key: LockKey | 'torch'; label: string; on: boolean };
export type SettingItem = RangeItem | SwitchItem;

const RANGE_KEYS = Object.keys(RANGE_LABELS) as RangeKey[];
const LOCK_KEYS = Object.keys(LOCK_LABELS) as LockKey[];

export function useCameraSettings(stream: MediaStream | null) {
  const track = stream?.getVideoTracks()[0];
  const { caps, initial } = useMemo(
    () => ({
      caps: (track?.getCapabilities?.() ?? {}) as Caps,
      initial: (track?.getSettings?.() ?? {}) as Current,
    }),
    [track],
  );
  const [changed, setChanged] = useState<Current>({});
  const current: Current = { ...initial, ...changed };

  const items: SettingItem[] = [];
  const missing: string[] = [];
  for (const key of RANGE_KEYS) {
    const r = caps[key];
    if (!r || typeof r.min !== 'number' || typeof r.max !== 'number') {
      missing.push(RANGE_LABELS[key]);
      continue;
    }
    const step = r.step && r.step > 0 ? r.step : (r.max - r.min) / 20;
    items.push({
      kind: 'range',
      key,
      label: RANGE_LABELS[key],
      min: r.min,
      max: r.max,
      step,
      value: current[key] ?? r.min,
    });
  }
  for (const key of LOCK_KEYS) {
    if (caps[key]?.includes('manual'))
      items.push({ kind: 'switch', key, label: LOCK_LABELS[key], on: current[key] === 'manual' });
    else missing.push(LOCK_LABELS[key]);
  }
  if (caps.torch)
    items.push({ kind: 'switch', key: 'torch', label: TORCH_LABEL, on: current.torch === true });
  else missing.push(TORCH_LABEL);

  const apply = useCallback(
    (constraints: Record<string, unknown>) => {
      setChanged((prev) => ({ ...prev, ...constraints }));
      // Réglage direct de la vraie caméra ; une valeur refusée par l'appareil est ignorée.
      void track
        ?.applyConstraints({ advanced: [constraints as MediaTrackConstraintSet] })
        .catch(() => undefined);
    },
    [track],
  );

  const setRange = useCallback(
    (key: RangeKey, value: number) => {
      const mode = NEEDS_MANUAL[key];
      apply(mode ? { [mode]: 'manual', [key]: value } : { [key]: value });
    },
    [apply],
  );

  const setSwitch = useCallback(
    (key: LockKey | 'torch', on: boolean) =>
      apply({ [key]: key === 'torch' ? on : on ? 'manual' : 'continuous' }),
    [apply],
  );

  /** Remet les modes en automatique et la lampe éteinte (les curseurs reviennent à leur valeur de départ). */
  const reset = useCallback(() => {
    const back: Record<string, unknown> = {};
    for (const key of LOCK_KEYS) if (caps[key]?.includes('continuous')) back[key] = 'continuous';
    if (caps.torch) back.torch = false;
    for (const key of RANGE_KEYS) if (typeof initial[key] === 'number' && caps[key]) back[key] = initial[key];
    apply(back);
  }, [apply, caps, initial]);

  /** Ce que le navigateur annonce (utile pour comprendre pourquoi un réglage manque). */
  const exposed = Object.keys(caps).sort();

  return { items, missing, exposed, setRange, setSwitch, reset };
}
