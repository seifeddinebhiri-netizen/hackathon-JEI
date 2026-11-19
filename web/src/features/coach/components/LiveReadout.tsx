import type { Measurements } from '../measure/compare';
import { warmthWord } from '../measure/warmth';

const fmt = (v: number, digits = 2, signed = false) =>
  `${signed && v >= 0 ? '+' : ''}${v.toFixed(digits)}`.replace('.', ',');

/** Une ligne toujours visible : luminosité, contraste et chaleur de l'image. */
export function LiveReadout({ m }: { m: Measurements }) {
  const ready = m.luma !== null && m.contrast !== null && m.warmth !== null;
  return (
    <p
      aria-label="Mesures de l’image"
      className="pointer-events-none absolute inset-x-0 top-1 text-center font-mono text-label text-paper [text-shadow:0_1px_6px_rgb(18_17_16/0.95)]"
    >
      {ready
        ? `Lum. ${fmt(m.luma!)} · Contraste ${fmt(m.contrast!)} · Image ${warmthWord(m.warmth!)} (${fmt(m.warmth!, 2, true)})`
        : 'Mesure de l’image…'}
    </p>
  );
}
