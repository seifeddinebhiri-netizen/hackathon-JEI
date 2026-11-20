import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DECK, type TransitionType } from '@/data/deck';
import { DeckEnvContext } from '@/hooks/deckEnv';
import { KeyCaptureContext, type KeyHandler } from '@/hooks/keyCapture';
import { Stage, useStageScale } from '@/components/Stage';
import { GuideMascot } from '@/components/GuideMascot';
import { Controls, NotesPanel, Overview } from '@/components/Controls';
import { CHANNEL, PresenterView, type Msg } from '@/components/PresenterView';
import { asset } from '@/components/ui';
import { TransitionLayer, type TransitionRun } from '@/transitions/TransitionLayer';

const params = new URLSearchParams(window.location.search);
const PRINT = params.has('print');
const PRESENTER = params.has('presenter');

const clampNav = (scene: number, beat: number) => {
  const s = Math.max(0, Math.min(DECK.length - 1, scene || 0));
  return { scene: s, beat: Math.max(0, Math.min(DECK[s].beats - 1, beat || 0)) };
};

function initialNav() {
  if (PRINT) return clampNav(Number(params.get('s')), Number(params.get('b')));
  const m = window.location.hash.match(/^#(\d+)\.(\d+)$/);
  return m ? clampNav(Number(m[1]), Number(m[2])) : { scene: 0, beat: 0 };
}

/** Images à précharger : la projection ne doit jamais attendre une capture. */
const PRELOAD = [
  ...['salut', 'parle', 'montre', 'planifier', 'tourner', 'declarer', 'diffuser'].map((p) => `mascotte/baba-jamil-${p}.svg`),
  ...['01', '02', '05', '10', '13'].map((n) => `premier-pitch/page-${n}.png`),
  'temoins/eya-hachicha.jpg',
  'temoins/eya-guirat.jpg',
  'premier-pitch/temoin-nour.png',
  'premier-pitch/temoin-mariem.png',
  'premier-pitch/temoin-tarek.png',
  'premier-pitch/el-teatro.png',
  'premier-pitch/pitch1-planner.png',
  'premier-pitch/pitch1-coach-illustration.png',
  ...[
    'maquette-SousTitres',
    'festival-sous-titres',
    'calendrier-long',
    'mobile-accueil',
    'mobile-calendrier',
    'mobile-passeport',
    'parcours-3-decoupage',
    'parcours-7-lieux-proposes',
    'coach',
    'passeport',
    'verification',
    'festival-trouver',
  ].map((c) => `captures/${c}.png`),
];

export default function App() {
  if (PRESENTER) return <PresenterView />;
  return <Deck />;
}

function Deck() {
  const scale = useStageScale();
  const [nav, setNav] = useState(initialNav);
  const [run, setRun] = useState<TransitionRun | null>(null);
  const pending = useRef<{ scene: number; beat: number } | null>(null);
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [auto, setAuto] = useState(false);
  const [notes, setNotes] = useState(false);
  const [overview, setOverview] = useState(false);
  const sceneLayer = useRef<HTMLDivElement>(null);
  const keySlot = useRef<KeyHandler | null>(null);
  const runId = useRef(0);
  const navRef = useRef(nav);
  navRef.current = nav;
  const busy = useRef(false);

  const startTransition = useCallback((scene: number, beat: number, type: TransitionType) => {
    if (busy.current) return;
    if (PRINT) {
      setNav({ scene, beat });
      return;
    }
    busy.current = true;
    pending.current = { scene, beat };
    setRun({ id: ++runId.current, type });
  }, []);

  const next = useCallback(() => {
    if (busy.current) return;
    const { scene, beat } = navRef.current;
    if (beat < DECK[scene].beats - 1) setNav({ scene, beat: beat + 1 });
    else if (scene < DECK.length - 1) startTransition(scene + 1, 0, DECK[scene + 1].enter);
  }, [startTransition]);

  const prev = useCallback(() => {
    if (busy.current) return;
    const { scene, beat } = navRef.current;
    if (beat > 0) setNav({ scene, beat: beat - 1 });
    else if (scene > 0) startTransition(scene - 1, DECK[scene - 1].beats - 1, 'cut');
  }, [startTransition]);

  const goto = useCallback(
    (scene: number) => {
      setOverview(false);
      if (scene === navRef.current.scene) setNav({ scene, beat: 0 });
      else startTransition(scene, 0, 'cut');
    },
    [startTransition],
  );

  const onCover = useCallback(() => {
    if (pending.current) setNav(pending.current);
    pending.current = null;
  }, []);
  const onDone = useCallback(() => {
    busy.current = false;
    setRun(null);
  }, []);

  // Clavier
  useEffect(() => {
    if (PRINT) return;
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (overview && e.key === 'Escape') {
        setOverview(false);
        return;
      }
      if (keySlot.current?.(e)) {
        e.preventDefault();
        return;
      }
      const k = e.key;
      if (k === 'ArrowRight' || k === ' ' || k === 'PageDown') {
        e.preventDefault();
        next();
      } else if (k === 'ArrowLeft' || k === 'PageUp') {
        e.preventDefault();
        prev();
      } else if (k === 'Home') goto(0);
      else if (k === 'End') goto(DECK.length - 1);
      else if (/^[0-6]$/.test(k)) {
        const i = DECK.findIndex((d) => d.num === `0${k}`);
        if (i >= 0) goto(i);
      } else if (k === 'p' || k === 'P') setOverview((o) => !o);
      else if (k === 'n' || k === 'N') setNotes((o) => !o);
      else if (k === 'm' || k === 'M') setReduced((o) => !o);
      else if (k === 'a' || k === 'A') setAuto((o) => !o);
      else if (k === 'w' || k === 'W') openPresenter();
      else if (k === 'f' || k === 'F') {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen?.();
      } else if (k === 'Escape') setNotes(false);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [next, prev, goto, overview]);

  // Fenêtre présentateur (BroadcastChannel)
  const channel = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    if (PRINT || typeof BroadcastChannel === 'undefined') return;
    const c = new BroadcastChannel(CHANNEL);
    channel.current = c;
    c.onmessage = (e: MessageEvent<Msg>) => {
      const m = e.data;
      if (m.type === 'cmd' && m.cmd === 'next') next();
      else if (m.type === 'cmd' && m.cmd === 'prev') prev();
      else if (m.type === 'goto') goto(m.scene);
      else if (m.type === 'cmd' && m.cmd === 'hello') c.postMessage({ type: 'state', ...navRef.current } satisfies Msg);
    };
    return () => c.close();
  }, [next, prev, goto]);

  // Diffusion de l'état + adresse (#scène.étape) pour reprendre après un rechargement
  useEffect(() => {
    if (PRINT) return;
    channel.current?.postMessage({ type: 'state', ...nav } satisfies Msg);
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${nav.scene}.${nav.beat}`);
  }, [nav]);

  // Lecture automatique (facultative) : durées de deck.ts
  useEffect(() => {
    if (!auto || run || PRINT) return;
    const d = DECK[nav.scene];
    if (nav.scene === DECK.length - 1 && nav.beat === d.beats - 1) return;
    const t = window.setTimeout(next, (d.beatSeconds?.[nav.beat] ?? 8) * 1000);
    return () => window.clearTimeout(t);
  }, [auto, run, nav, next]);

  // Préchargement
  useEffect(() => {
    PRELOAD.forEach((p) => {
      const i = new Image();
      i.src = asset(p);
    });
  }, []);

  const registerKeys = useCallback((h: KeyHandler | null) => {
    keySlot.current = h;
  }, []);
  const env = useMemo(() => ({ reduced, print: PRINT, scale }), [reduced, scale]);
  const d = DECK[nav.scene];
  const Scene = d.Component;
  const spec = d.mascot[nav.beat] ?? d.mascot[d.mascot.length - 1] ?? null;

  return (
    <DeckEnvContext.Provider value={env}>
      <KeyCaptureContext.Provider value={registerKeys}>
        <Stage scale={scale}>
          <div ref={sceneLayer} className="absolute inset-0" data-scene={d.id}>
            <Scene key={nav.scene} beat={nav.beat} />
          </div>
          <GuideMascot spec={spec} reduced={reduced} print={PRINT} />
          {!PRINT ? <TransitionLayer run={run} reduced={reduced} sceneLayer={sceneLayer} onCover={onCover} onDone={onDone} /> : null}
          <p className="sr-only" aria-live="polite">
            {d.num} · {d.title}, étape {nav.beat + 1} sur {d.beats}
          </p>
        </Stage>
        {!PRINT ? (
          <>
            <Controls
              scene={nav.scene}
              beat={nav.beat}
              onPrev={prev}
              onNext={next}
              onGoto={goto}
              reduced={reduced}
              onToggleMotion={() => setReduced((r) => !r)}
              auto={auto}
              onToggleAuto={() => setAuto((a) => !a)}
              showNotes={notes}
              onToggleNotes={() => setNotes((n) => !n)}
              onOpenPresenter={openPresenter}
              overview={overview}
              onToggleOverview={() => setOverview((o) => !o)}
            />
            {notes ? <NotesPanel scene={nav.scene} beat={nav.beat} /> : null}
            {overview ? <Overview scene={nav.scene} onGoto={goto} onClose={() => setOverview(false)} /> : null}
          </>
        ) : null}
      </KeyCaptureContext.Provider>
    </DeckEnvContext.Provider>
  );
}

function openPresenter() {
  window.open(`${window.location.pathname}?presenter`, 'encadre-presentateur', 'width=1100,height=760');
}
