/**
 * Montage du téléphone quand l'utilisateur filme avec une VRAIE caméra : le téléphone est fixé
 * au-dessus ou en dessous, et sert de Coach. Il n'est pas toujours exactement parallèle à la caméra :
 * un réglage d'inclinaison (« un peu plus haut » ou « un peu plus bas ») corrige le calcul de l'angle.
 *
 * Seul l'angle est corrigé. Le décalage de position (parallaxe) et la différence de champ de vision
 * entre le téléphone et la caméra ne sont PAS modélisés : les voyants de cadrage sont approximatifs
 * si les deux ne voient pas la même image.
 */
export type MountKind = 'phone' | 'above' | 'below';
export type Mount = {
  kind: MountKind;
  /** + : le téléphone regarde plus haut que la caméra. */ tiltDeg: number;
};

export const DEFAULT_MOUNT: Mount = { kind: 'phone', tiltDeg: 0 };
export const MOUNT_TILT = { min: -10, max: 10, step: 0.5 } as const;
export const MOUNT_OPTIONS: { value: MountKind; label: string }[] = [
  { value: 'phone', label: 'Je filme avec le téléphone' },
  { value: 'above', label: 'Téléphone fixé au-dessus de ma caméra' },
  { value: 'below', label: 'Téléphone fixé sous ma caméra' },
];

/** Angle de la caméra principale, déduit de celui du téléphone. */
export function correctPitch(phonePitch: number, mount: Mount): number {
  return mount.kind === 'phone' ? phonePitch : phonePitch - mount.tiltDeg;
}

/** Valeur valide : dans l'intervalle, au pas du curseur. */
export function clampTilt(v: number): number {
  if (!Number.isFinite(v)) return 0;
  const clamped = Math.min(MOUNT_TILT.max, Math.max(MOUNT_TILT.min, v));
  return Math.round(clamped / MOUNT_TILT.step) * MOUNT_TILT.step;
}

export function describeTilt(deg: number): string {
  if (deg === 0) return 'parallèle à la caméra';
  const n = Math.abs(deg).toFixed(1).replace('.0', '').replace('.', ',');
  return `${n}° plus ${deg > 0 ? 'haut' : 'bas'} que la caméra`;
}

const KEY = 'pp-coach-mount-v1';

export function loadMount(): Mount {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Mount> | null;
    if (raw && MOUNT_OPTIONS.some((o) => o.value === raw.kind)) {
      return { kind: raw.kind as MountKind, tiltDeg: clampTilt(Number(raw.tiltDeg)) };
    }
  } catch {
    /* stockage indisponible ou contenu invalide */
  }
  return DEFAULT_MOUNT;
}

export function saveMount(mount: Mount): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(mount));
  } catch {
    /* tant pis : valable pour cette session */
  }
}
