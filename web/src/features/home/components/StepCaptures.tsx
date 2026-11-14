import { Icon } from '@/components/ui';
import { AiLabel } from '@/features/passport/components/AiLabel';
import type { DepartmentDeclaration } from '@/api/types';
import { cn } from '@/lib/cn';
import { CaptureFrame } from './CaptureFrame';

/* Contenu d'illustration : film fictif, aucune vraie donnée. */

const WEEK = [
  { d: 'Lun', blocks: [{ k: 'EXT', t: 'Sc. 2 · Ruelles', icon: 'sun' }, { k: 'INT', t: 'Sc. 1 · Café', icon: 'sun' }] },
  { d: 'Mar', blocks: [] },
  { d: 'Mer', blocks: [{ k: 'INT', t: 'Sc. 3 · Appart.', icon: 'moon' }] },
  { d: 'Jeu', blocks: [{ k: 'EXT', t: 'Sc. 5 · Route', icon: 'sunrise' }, { k: 'EXT', t: 'Sc. 4 · Plage', icon: 'golden' }] },
  { d: 'Ven', blocks: [{ k: 'X', t: 'Médina fermée', icon: 'x' }] },
] as const;

export function PlannerCapture() {
  return (
    <CaptureFrame path="planner/calendrier" tilt="left">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-display text-[18px] font-bold">Semaine 1</p>
        <span className="eyebrow border border-dashed border-ink bg-gold-soft px-1.5 py-0.5">Brouillon IA</span>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {WEEK.map((col) => (
          <div key={col.d} className="flex min-h-40 flex-col gap-1.5 border border-line-light bg-paper p-1.5">
            <p className="eyebrow text-center">{col.d}</p>
            {col.blocks.map((b) => (
              <div
                key={b.t}
                className={cn(
                  'border-l-4 p-1 text-label leading-tight',
                  b.k === 'EXT' && 'border-ink bg-ext',
                  b.k === 'INT' && 'border-muted-on-light bg-int',
                  b.k === 'X' && 'border-bad-fg bg-bad-bg text-bad-fg',
                )}
              >
                <span className="flex items-center gap-1 font-mono font-medium">
                  <Icon name={b.icon} size={12} />
                  {b.k === 'X' ? 'Fermé' : b.k}
                </span>
                <span className="block truncate">{b.t}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-label font-semibold text-warn-fg">
        <Icon name="alert" size={14} /> 1 conflit : autorisation à demander (médina)
      </p>
    </CaptureFrame>
  );
}

export function CoachCapture() {
  return (
    <CaptureFrame path="coach" tilt="right">
      <div className="mx-auto w-48 border-[6px] border-ink bg-ink p-1">
        <div className="bg-paper p-3">
          <p className="eyebrow text-muted-on-light">Aujourd’hui</p>
          <p className="font-display text-[18px] leading-tight font-bold">3 scènes · Médina</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {['Sc. 1 · Café · 10 h', 'Sc. 2 · Ruelles · 12 h 30', 'Sc. 7 · Nuit · 17 h 45'].map((s) => (
              <li key={s} className="border-l-4 border-ink bg-white px-2 py-1 text-label">
                {s}
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-start gap-1 text-label leading-snug">
            <Icon name="lock" size={12} className="mt-0.5 shrink-0" />
            Images traitées sur le téléphone. Rien n’est envoyé.
          </p>
        </div>
      </div>
    </CaptureFrame>
  );
}

const SAMPLE: DepartmentDeclaration[] = [
  { department: 'scenario', used_ai: false, what: '', human_decisions: '' },
  { department: 'image', used_ai: false, what: '', human_decisions: '' },
  { department: 'montage', used_ai: true, what: '', level: 'assistance', human_decisions: '' },
  { department: 'son_voix', used_ai: true, what: '', level: 'assistance', human_decisions: '' },
  { department: 'musique', used_ai: false, what: '', human_decisions: '' },
  { department: 'vfx', used_ai: false, what: '', human_decisions: '' },
  { department: 'sous_titres', used_ai: true, what: '', level: 'generation_partielle', human_decisions: '' },
  { department: 'affiche_promo', used_ai: false, what: '', human_decisions: '' },
];

export function PassportCapture() {
  return (
    <CaptureFrame path="passeport" tilt="left">
      <AiLabel filmTitle="Marée basse" director="Yassine" badgeCode="PP-7K3Q-2M" declarations={SAMPLE} compact className="mx-auto max-w-sm" />
    </CaptureFrame>
  );
}

const DEADLINES = [
  { name: '[Festival D]', j: 12, pct: 80, urgent: true },
  { name: '[Festival B]', j: 21, pct: 45, urgent: false },
  { name: '[Festival A]', j: 38, pct: 20, urgent: false },
];

export function FestivalCapture() {
  return (
    <CaptureFrame path="festival?onglet=selection" tilt="right">
      <p className="font-display text-[18px] font-bold">Ma sélection</p>
      <div className="relative mt-4 ml-2 border-l-2 border-ink pl-5">
        {DEADLINES.map((f) => (
          <div key={f.name} className="relative mb-4 last:mb-0">
            <span className="absolute top-1.5 -left-[27px] size-3 border-2 border-ink bg-gold" />
            <div className="flex items-center justify-between gap-2">
              <p className="text-meta font-semibold">{f.name}</p>
              <span
                className={cn(
                  'border-2 px-1.5 font-mono text-label',
                  f.urgent ? 'border-bad-fg bg-bad-bg text-bad-fg' : 'border-ink',
                )}
              >
                J-{f.j}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-2 flex-1 border border-ink bg-paper">
                <div className="h-full bg-ink" style={{ width: `${f.pct}%` }} />
              </div>
              <span className="font-mono text-label">{f.pct} %</span>
            </div>
          </div>
        ))}
      </div>
    </CaptureFrame>
  );
}
