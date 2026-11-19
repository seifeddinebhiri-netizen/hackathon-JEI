/**
 * Fiche de tournage d'une scène, en lecture : calendrier (bulle), feuille de service et PDF du
 * planning. Seules les rubriques remplies sont affichées ; rien si la scène n'a pas de fiche.
 */
import type { SceneDetail } from '@/api/types';
import { cn } from '@/lib/cn';

const ROWS: { key: keyof SceneDetail; label: string }[] = [
  { key: 'on_screen', label: 'À l’image' },
  { key: 'props', label: 'Accessoires' },
  { key: 'costumes', label: 'Costumes' },
  { key: 'extras', label: 'Figurants' },
  { key: 'sound', label: 'Son' },
  { key: 'special', label: 'Véhicules, animaux, effets' },
];

const text = (v: SceneDetail[keyof SceneDetail]) => (Array.isArray(v) ? v.join(', ') : v).trim();

export function SceneDetailView({
  detail,
  compact,
  className,
}: {
  detail: SceneDetail | undefined;
  /** Version courte (bulle du calendrier) : ce qui se passe et les points à prévoir. */
  compact?: boolean;
  className?: string;
}) {
  if (!detail) return null;
  const rows = compact ? [] : ROWS.filter((r) => text(detail[r.key]));
  return (
    <div className={cn('print-avoid text-meta', className)}>
      <p className="eyebrow text-muted-on-light">Fiche de tournage</p>
      {detail.what_happens ? (
        <p className={cn('mt-1', compact && 'line-clamp-4')}>{detail.what_happens}</p>
      ) : null}
      {rows.length ? (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {rows.map((r) => (
            <div key={r.key} className="contents">
              <dt className="font-semibold">{r.label}</dt>
              <dd>{text(detail[r.key])}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {detail.watch_out.length ? (
        <div className="mt-2">
          <p className="font-semibold">À prévoir</p>
          <ul className="list-disc pl-5">
            {(compact ? detail.watch_out.slice(0, 2) : detail.watch_out).map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
