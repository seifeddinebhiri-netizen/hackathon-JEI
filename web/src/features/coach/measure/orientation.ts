/**
 * Inclinaison du téléphone, calculée à partir de ses capteurs de mouvement.
 *
 * Les angles beta/gamma de l'événement `deviceorientation` (norme W3C, identique sur iPhone et
 * Android) donnent la direction du « haut » du monde dans le repère de l'appareil (x = droite de
 * l'écran, y = haut de l'écran, z = hors de l'écran, vers l'utilisateur). Le reste est de la
 * géométrie : aucune IA.
 *
 *   roll  > 0 : le téléphone est tourné vers la gauche (sens antihoraire), l'horizon de l'image
 *               penche vers la droite. Pour corriger, tourner le téléphone vers la droite.
 *   pitch > 0 : la caméra arrière regarde vers le haut.
 */
export type Vec3 = { x: number; y: number; z: number };

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Direction du haut du monde dans le repère de l'appareil (vecteur unitaire). */
export function upFromEuler(betaDeg: number, gammaDeg: number): Vec3 {
  const b = rad(betaDeg);
  const g = rad(gammaDeg);
  return { x: -Math.sin(g) * Math.cos(b), y: Math.sin(b), z: Math.cos(b) * Math.cos(g) };
}

/**
 * Le même vecteur dans le repère de l'image affichée.
 * `screenAngle` = rotation de l'écran (0 portrait, 90 appareil tourné vers la gauche, 180, 270).
 */
export function toScreenFrame(up: Vec3, screenAngle: number): { right: number; up: number } {
  switch (((Math.round(screenAngle / 90) % 4) + 4) % 4) {
    case 1:
      return { right: -up.y, up: up.x };
    case 2:
      return { right: -up.x, up: -up.y };
    case 3:
      return { right: up.y, up: -up.x };
    default:
      return { right: up.x, up: up.y };
  }
}

export type RollPitch = {
  roll: number;
  pitch: number;
  /** Faux quand le téléphone est presque à plat : l'inclinaison de l'horizon n'a plus de sens. */
  rollValid: boolean;
};

export function rollPitch(up: Vec3, screenAngle = 0): RollPitch {
  const s = toScreenFrame(up, screenAngle);
  const pitch = deg(Math.asin(clamp(-up.z, -1, 1)));
  return { roll: deg(Math.atan2(s.right, s.up)), pitch, rollValid: Math.abs(pitch) < 60 };
}

/** Lissage exponentiel d'un vecteur (réduit le tremblement du capteur) puis renormalisation. */
export function smoothVec(prev: Vec3 | null, next: Vec3, alpha: number): Vec3 {
  if (!prev) return next;
  const v = {
    x: prev.x + alpha * (next.x - prev.x),
    y: prev.y + alpha * (next.y - prev.y),
    z: prev.z + alpha * (next.z - prev.z),
  };
  const n = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / n, y: v.y / n, z: v.z / n };
}

/** Tremblement : vitesse de rotation efficace (RMS, en rad/s) sur une fenêtre glissante. */
export class ShakeMeter {
  private samples: { t: number; v: number }[] = [];
  constructor(private windowMs = 1000) {}

  /** `degPerSec` : norme de la vitesse de rotation du gyroscope, en degrés par seconde. */
  push(nowMs: number, degPerSec: number): void {
    this.samples.push({ t: nowMs, v: rad(degPerSec) });
    while (this.samples.length && nowMs - this.samples[0].t > this.windowMs) this.samples.shift();
  }

  /** null tant qu'il n'y a pas assez de mesures. */
  rms(): number | null {
    if (this.samples.length < 5) return null;
    return Math.sqrt(this.samples.reduce((s, x) => s + x.v * x.v, 0) / this.samples.length);
  }
}
