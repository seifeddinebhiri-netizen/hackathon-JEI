import { compassLabel, sunInfo, sunPosition } from '@/lib/sun';
import { formatTime } from '@/lib/format';

/**
 * Schéma SVG de la course du soleil sur la journée : lever à l'est (gauche), coucher à l'ouest (droite),
 * position du soleil au début du créneau, direction et hauteur.
 */
export function SunDiagram({
  at,
  lat,
  lon,
  className,
}: {
  at: Date;
  lat: number;
  lon: number;
  className?: string;
}) {
  const sun = sunInfo(at, lat, lon);
  const pos = sunPosition(at, lat, lon);
  const noonAlt = Math.max(5, sunPosition(sun.solarNoon, lat, lon).altitude);
  const span = sun.sunset.getTime() - sun.sunrise.getTime();
  const t = Math.min(1.15, Math.max(-0.15, (at.getTime() - sun.sunrise.getTime()) / span));

  const W = 320;
  const H = 170;
  const x0 = 30;
  const x1 = W - 30;
  const base = 130;
  const peak = 30;
  // Arc parabolique : hauteur proportionnelle à l'altitude max du jour
  const px = x0 + (x1 - x0) * t;
  const py = base - (base - peak) * 4 * t * (1 - t) * (noonAlt / 90) * 1.6;
  const path = Array.from({ length: 41 }, (_, i) => {
    const u = i / 40;
    const x = x0 + (x1 - x0) * u;
    const y = base - (base - peak) * 4 * u * (1 - u) * (noonAlt / 90) * 1.6;
    return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
  const up = pos.altitude > 0;
  const golden = at >= sun.goldenEvening.from && at <= sun.goldenEvening.to;
  const label = up
    ? `Soleil au ${compassLabel(pos.azimuth)}, à ${Math.round(pos.altitude)}° au-dessus de l’horizon${golden ? ', lumière douce' : ''}.`
    : 'Soleil sous l’horizon.';

  return (
    <figure className={className}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Course du soleil. Lever ${formatTime(sun.sunrise)}, coucher ${formatTime(sun.sunset)}. À ${formatTime(at)} : ${label}`}
        className="w-full"
      >
        <rect x="0" y="0" width={W} height={H} fill="var(--color-ink)" />
        {/* sol */}
        <rect x="0" y={base} width={W} height={H - base} fill="var(--color-surface-dark)" />
        <line x1="0" y1={base} x2={W} y2={base} stroke="var(--color-line-dark)" strokeWidth="2" />
        {/* course */}
        <path
          d={path}
          fill="none"
          stroke="var(--color-muted-on-dark)"
          strokeWidth="2"
          strokeDasharray="4 5"
        />
        {/* soleil */}
        <circle
          cx={px}
          cy={up ? py : base + 14}
          r="11"
          fill={golden ? 'var(--color-brand-red)' : 'var(--color-gold)'}
        />
        {/* repères */}
        <text
          x={x0}
          y={base + 22}
          fill="var(--color-paper)"
          fontSize="12"
          fontFamily="var(--font-mono)"
          textAnchor="middle"
        >
          E
        </text>
        <text
          x={x1}
          y={base + 22}
          fill="var(--color-paper)"
          fontSize="12"
          fontFamily="var(--font-mono)"
          textAnchor="middle"
        >
          O
        </text>
        <text
          x={x0}
          y={base + 36}
          fill="var(--color-muted-on-dark)"
          fontSize="12"
          fontFamily="var(--font-mono)"
          textAnchor="middle"
        >
          {formatTime(sun.sunrise)}
        </text>
        <text
          x={x1}
          y={base + 36}
          fill="var(--color-muted-on-dark)"
          fontSize="12"
          fontFamily="var(--font-mono)"
          textAnchor="middle"
        >
          {formatTime(sun.sunset)}
        </text>
        <text
          x={W / 2}
          y={18}
          fill="var(--color-paper)"
          fontSize="12"
          fontFamily="var(--font-mono)"
          textAnchor="middle"
        >
          {formatTime(at)} · {up ? `${compassLabel(pos.azimuth)} · ${Math.round(pos.altitude)}°` : 'nuit'}
        </text>
      </svg>
      <figcaption className="mt-2 text-meta text-muted-on-light">{label}</figcaption>
    </figure>
  );
}
