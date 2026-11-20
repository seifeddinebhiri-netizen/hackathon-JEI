import { MATURITY_LABEL, type Block, type Diagram, type Maturity } from '@/data/backend';
import { cx } from './ui';

/**
 * Diagramme back-end d'un module : flux de gauche à droite, du geste de l'utilisateur au stockage.
 * Grille de 5 colonnes × 2 rangées dans un panneau de 1740 × 690 px. Les lignes portent la classe
 * « edge » (pathLength = 1 : on les dessine en animant stroke-dashoffset de 1 à 0), les blocs « blk ».
 */
export const BW = 310;
export const BH = 228;
const COL_X = (c: number) => c * 357;
const ROW_Y = (r: number) => 130 + r * 290;

export const MAT_ICON: Record<Maturity, string> = { integre: '●', partiel: '◐', prevu: '○' };
export const MAT_CLS: Record<Maturity, string> = {
  integre: 'text-ok-bright',
  partiel: 'text-gold',
  prevu: 'text-muted-on-dark',
};

function edgePath(a: Block, b: Block): string {
  const ax = COL_X(a.col);
  const ay = ROW_Y(a.row);
  const bx = COL_X(b.col);
  const by = ROW_Y(b.row);
  if (a.col === b.col) {
    const down = b.row > a.row;
    const x = ax + BW / 2;
    return down ? `M${x},${ay + BH} L${x},${by}` : `M${x},${ay} L${x},${by + BH}`;
  }
  const x1 = ax + BW;
  const y1 = ay + BH / 2;
  const x2 = bx;
  const y2 = by + BH / 2;
  if (a.row === b.row) return `M${x1},${y1} L${x2},${y2}`;
  const dx = (x2 - x1) / 2;
  return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
}

export function BackendDiagram({ diagram }: { diagram: Diagram }) {
  const byId = Object.fromEntries(diagram.blocks.map((b) => [b.id, b]));
  return (
    <>
      <svg aria-hidden viewBox="0 0 1740 690" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
        {diagram.edges.map(([a, b, style]) => (
          <path
            key={`${a}-${b}`}
            className={cx('edge', style === 'dashed' && 'edge-dashed')}
            d={edgePath(byId[a], byId[b])}
            fill="none"
            stroke="#FFC82E"
            strokeOpacity={style === 'dashed' ? 0.45 : 0.7}
            strokeWidth="5"
            pathLength={1}
            strokeDasharray={style === 'dashed' ? '0.02 0.02' : '1'}
            strokeDashoffset={0}
          />
        ))}
      </svg>
      {diagram.blocks.map((b) => (
        <div
          key={b.id}
          title={`Preuve : ${b.proof}`}
          className={cx('blk absolute flex flex-col border-[3px] bg-[#141311] p-4', b.status === 'prevu' ? 'border-dashed border-muted-on-dark' : 'border-[#2f2c29]')}
          style={{ left: COL_X(b.col), top: ROW_Y(b.row), width: BW, height: BH, boxShadow: '8px 8px 0 #000' }}
        >
          <p className="eyebrow text-[15px] leading-tight text-gold">{b.kicker}</p>
          <p className="display mt-1 text-[29px] leading-[1.02] text-paper">{b.title}</p>
          <div className="mt-2 flex flex-wrap gap-[6px]">
            {b.tags.map((t) => (
              <span key={t} className="border border-line-dark px-2 py-[2px] font-mono text-[15px] text-muted-on-dark">
                {t}
              </span>
            ))}
          </div>
          <p className={cx('mt-auto text-[17px] font-medium', MAT_CLS[b.status])}>
            {MAT_ICON[b.status]} <span className="text-paper">{MATURITY_LABEL[b.status]}</span>
          </p>
        </div>
      ))}
    </>
  );
}

export function MaturityLegend({ className }: { className?: string }) {
  return (
    <p className={cx('flex items-center gap-6 text-[19px]', className)}>
      {(Object.keys(MATURITY_LABEL) as Maturity[]).map((m) => (
        <span key={m} className={MAT_CLS[m]}>
          {MAT_ICON[m]} <span className="text-paper">{MATURITY_LABEL[m]}</span>
        </span>
      ))}
    </p>
  );
}
