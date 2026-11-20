import { forwardRef, useLayoutEffect, useRef, type CSSProperties } from 'react';
import gsap from 'gsap';

/**
 * Clap de cinéma (accessoire dessiné, distinct de la mascotte).
 * Le bras supérieur porte la classe « clap-arm » : on l'anime avec GSAP (rotation, svgOrigin « 14 74 »).
 * rotation -28° = ouvert, 0° = fermé.
 */
export const Clapperboard = forwardRef<
  SVGSVGElement,
  {
    width?: number;
    title?: string;
    take?: string;
    scene?: string;
    footer?: string;
    open?: boolean;
    className?: string;
    style?: CSSProperties;
  }
>(function Clapperboard(
  { width = 420, title = 'ENCADRÉ', take = 'PRISE 02', scene = 'DERRIÈRE LA CAMÉRA', footer = 'HACKATHON IA ÉTHIQUE 360', open = true, className, style },
  ref,
) {
  const stripes = Array.from({ length: 7 }, (_, i) => i);
  const arm = useRef<SVGGElement>(null);
  // GSAP pose la rotation sur l'attribut transform (charnière en 14,74) : les tweens la reprennent ensuite.
  useLayoutEffect(() => {
    if (arm.current) gsap.set(arm.current, { rotation: open ? -28 : 0, svgOrigin: '14 74' });
  }, [open]);
  return (
    <svg
      ref={ref}
      viewBox="0 0 420 340"
      width={width}
      height={(width * 340) / 420}
      className={className}
      style={{ overflow: 'visible', ...style }}
      aria-hidden
    >
      {/* Corps */}
      <rect x="10" y="78" width="400" height="252" fill="#121110" stroke="#0b0b0a" strokeWidth="8" />
      <rect x="10" y="78" width="400" height="44" fill="#1f1d1b" />
      {stripes.map((i) => (
        <path key={i} d={`M${18 + i * 58} 122 L${48 + i * 58} 80 L${76 + i * 58} 80 L${46 + i * 58} 122 Z`} fill={i % 2 ? '#FFC82E' : '#F2F2EF'} />
      ))}
      <line x1="10" y1="200" x2="410" y2="200" stroke="#F2F2EF" strokeWidth="3" />
      <line x1="10" y1="262" x2="410" y2="262" stroke="#F2F2EF" strokeWidth="3" />
      <line x1="230" y1="200" x2="230" y2="262" stroke="#F2F2EF" strokeWidth="3" />
      <text x="30" y="178" fill="#F2F2EF" fontFamily="Space Grotesk, sans-serif" fontWeight="700" fontSize="44" letterSpacing="-1">
        {title}
      </text>
      <text x="30" y="242" fill="#FFC82E" fontFamily="JetBrains Mono, monospace" fontWeight="500" fontSize="26">
        {take}
      </text>
      <text x="246" y="226" fill="#B8B4AC" fontFamily="JetBrains Mono, monospace" fontSize="14">
        SCÈNE
      </text>
      <text x="246" y="250" fill="#F2F2EF" fontFamily="JetBrains Mono, monospace" fontSize="17">
        {scene.length > 16 ? scene.slice(0, 16) : scene}
      </text>
      <text x="30" y="306" fill="#B8B4AC" fontFamily="JetBrains Mono, monospace" fontSize="16" letterSpacing="1">
        {footer}
      </text>
      <rect x="378" y="296" width="18" height="18" fill="#E4202E" />
      {/* Bras supérieur (charnière à gauche) */}
      <g ref={arm} className="clap-arm">
        <rect x="10" y="34" width="400" height="40" fill="#1f1d1b" stroke="#0b0b0a" strokeWidth="8" />
        {stripes.map((i) => (
          <path key={i} d={`M${18 + i * 58} 74 L${48 + i * 58} 38 L${76 + i * 58} 38 L${46 + i * 58} 74 Z`} fill={i % 2 ? '#F2F2EF' : '#FFC82E'} />
        ))}
        <circle cx="22" cy="62" r="8" fill="#B8B4AC" stroke="#0b0b0a" strokeWidth="3" />
      </g>
    </svg>
  );
});
