import { useEffect, useRef, useState } from 'react';
import { DECK, TOTAL_SECONDS } from '@/data/deck';
import { cx } from './ui';

/**
 * Fenêtre présentateur (?presenter) : notes, étape suivante, chronomètre.
 * Synchronisée avec la fenêtre projetée par BroadcastChannel (même navigateur, même machine).
 */
export const CHANNEL = 'encadre-prise-02';
export type Msg = { type: 'state'; scene: number; beat: number } | { type: 'cmd'; cmd: 'next' | 'prev' | 'hello' } | { type: 'goto'; scene: number };

export function PresenterView() {
  const [state, setState] = useState({ scene: 0, beat: 0 });
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const ch = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    const c = new BroadcastChannel(CHANNEL);
    ch.current = c;
    c.onmessage = (e: MessageEvent<Msg>) => {
      if (e.data.type === 'state') setState({ scene: e.data.scene, beat: e.data.beat });
    };
    c.postMessage({ type: 'cmd', cmd: 'hello' } satisfies Msg);
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => {
      c.close();
      window.clearInterval(t);
    };
  }, []);

  const send = (m: Msg) => {
    if (start === null) setStart(Date.now());
    ch.current?.postMessage(m);
  };

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (['ArrowRight', ' ', 'PageDown'].includes(e.key)) {
        e.preventDefault();
        send({ type: 'cmd', cmd: 'next' });
      } else if (['ArrowLeft', 'PageUp'].includes(e.key)) {
        e.preventDefault();
        send({ type: 'cmd', cmd: 'prev' });
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  });

  const d = DECK[state.scene];
  const nextScene = DECK[state.scene + 1];
  const elapsed = start ? Math.floor((now - start) / 1000) : 0;
  const planned = DECK.slice(0, state.scene).reduce((s, x) => s + x.seconds, 0);
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="h-full overflow-auto bg-ink p-6 text-paper" style={{ fontFamily: 'var(--font-sans)' }}>
      <div className="flex items-center justify-between gap-4">
        <p className="eyebrow text-[14px] text-gold">Présentateur · Encadré prise 02</p>
        <p className="eyebrow text-[14px] text-muted-on-dark">
          Chrono {fmt(elapsed)} · prévu ici ~{fmt(planned)} · total ~{fmt(TOTAL_SECONDS)}{' '}
          <button type="button" className="ctrl ml-2 cursor-pointer border border-line-dark bg-transparent px-2 text-paper" onClick={() => setStart(Date.now())}>
            Remettre à zéro
          </button>
        </p>
      </div>
      <h1 className="display mt-4 text-[40px]">
        {d.num} · {d.title}
      </h1>
      <p className="mt-1 text-[16px] text-muted-on-dark">
        {d.place} · {d.question} · étape {state.beat + 1}/{d.beats} · ~{d.seconds} s
      </p>
      <div className="mt-5 border-l-4 border-gold pl-5">
        <p className="text-[24px] leading-relaxed">{d.notes[state.beat] ?? ''}</p>
      </div>
      {d.notes[state.beat + 1] ? (
        <p className="mt-5 text-[16px] text-muted-on-dark">
          <span className="eyebrow text-[12px] text-gold">Étape suivante · </span>
          {d.notes[state.beat + 1]}
        </p>
      ) : nextScene ? (
        <p className="mt-5 text-[16px] text-muted-on-dark">
          <span className="eyebrow text-[12px] text-gold">Séquence suivante · </span>
          {nextScene.num} · {nextScene.title} ({nextScene.enter})
        </p>
      ) : null}

      <div className="mt-8 flex gap-3">
        <button type="button" className="ctrl cursor-pointer border-2 border-paper bg-transparent px-6 text-[18px] text-paper" onClick={() => send({ type: 'cmd', cmd: 'prev' })}>
          ← Précédent
        </button>
        <button type="button" className="ctrl cursor-pointer border-2 border-gold bg-gold px-6 text-[18px] text-ink" onClick={() => send({ type: 'cmd', cmd: 'next' })}>
          Suivant →
        </button>
      </div>
      <ol className="mt-8 grid list-none grid-cols-2 gap-2 p-0 md:grid-cols-5">
        {DECK.map((s, i) => (
          <li key={s.id}>
            <button type="button" onClick={() => send({ type: 'goto', scene: i })} className={cx('ctrl w-full cursor-pointer border-2 p-2 text-left text-[13px]', i === state.scene ? 'border-gold bg-gold text-ink' : 'border-line-dark bg-transparent text-paper')}>
              {s.num} · {s.title}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
