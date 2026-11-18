import type { NumRange, ShotTargets } from '@/api/types';

const n = (v: number, digits = 0) => v.toFixed(digits).replace('.', ',');
const pct = (v: number) => `${n(v * 100)} %`;

function span(r: NumRange, f: (v: number) => string, unit = ''): string {
  return r.min === r.max ? `${f(r.min)}${unit}` : `${f(r.min)} à ${f(r.max)}${unit}`;
}

/** Les cibles chiffrées en phrases courtes, pour que l'utilisateur voie ce que le téléphone va vérifier. */
export function describeTargets(t: ShotTargets): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [
    {
      label: 'Horizon',
      value:
        t.roll_abs_deg.min === 0
          ? `incliné de ${n(t.roll_abs_deg.max)}° au plus`
          : `incliné de ${span(t.roll_abs_deg, (v) => n(v), '°')}`,
    },
  ];
  if (t.pitch_deg)
    rows.push({
      label: 'Angle de la caméra',
      value: span(t.pitch_deg, (v) => `${v > 0 ? '+' : ''}${n(v)}`, '°'),
    });
  else rows.push({ label: 'Cadrage', value: 'libre (plan en mouvement)' });
  if (t.subject_h)
    rows.push({ label: 'Taille du sujet', value: `${span(t.subject_h, (v) => n(v * 100))} % de l’image` });
  if (t.center_x)
    rows.push({
      label: 'Position du sujet',
      value: `entre ${pct(t.center_x.min)} et ${pct(t.center_x.max)} de la largeur`,
    });
  if (t.headroom)
    rows.push({
      label: 'Espace au-dessus de la tête',
      value: `${span(t.headroom, (v) => n(v * 100))} % de l’image`,
    });
  rows.push({ label: 'Luminosité', value: span(t.luma, (v) => n(v, 2)) });
  rows.push({ label: 'Contraste', value: span(t.contrast, (v) => n(v, 2)) });
  if (t.backlight_ratio_max !== null)
    rows.push({
      label: 'Contre-jour',
      value: `fond au plus ${n(t.backlight_ratio_max, 1)} fois plus clair que le visage`,
    });
  if (t.shake_max !== null) rows.push({ label: 'Tremblement', value: `moins de ${n(t.shake_max, 2)} rad/s` });
  return rows;
}
