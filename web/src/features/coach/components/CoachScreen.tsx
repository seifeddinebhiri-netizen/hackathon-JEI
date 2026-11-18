import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui';
import { allOkReadings, flipReading, pickInstruction, type CheckId, type Readings } from '../checks';
import { useAutoDemo } from '../demo';
import { isWebGLAvailable, NEUTRAL, useImagePipeline, type Adjust } from '../imageFilter';
import { correctPitch, describeTilt, type Mount, DEFAULT_MOUNT } from '../mount';
import { targetsAt } from '../plan/timeline';
import type { Targets } from '../measure/targets';
import type { Timeline } from '@/api/types';
import { useShotClock } from '../useShotClock';
import { useFaceDetector } from '../measure/useFaceDetector';
import { useFrameStats } from '../measure/useFrameStats';
import { useLiveReadings } from '../measure/useLiveReadings';
import { useOrientation } from '../measure/useOrientation';
import { CAMERA_MESSAGES, useCamera } from '../useCamera';
import { useCameraSettings, type SettingKey } from '../useCameraSettings';
import { formatDuration, useRecorder } from '../useRecorder';
import { CheckDots } from './CheckDots';
import { CoachControls } from './CoachControls';
import { InstructionOverlay } from './InstructionOverlay';
import { LiveReadout } from './LiveReadout';
import { QuickAdjust } from './QuickAdjust';
import { MeasurementsHud } from './MeasurementsHud';
import { RecordingSheet } from './RecordingSheet';
import { SettingsSheet } from './SettingsSheet';
import { TimelineStrip } from './TimelineStrip';

const SHADOW = '[text-shadow:0_1px_6px_rgb(18_17_16/0.9)]';
const LIGHT_ADJUST: (keyof Adjust)[] = ['exposure', 'brightness', 'contrast'];
const LIGHT_SETTINGS: SettingKey[] = [
  'exposureCompensation',
  'brightness',
  'contrast',
  'iso',
  'exposureMode',
  'torch',
];
const NONE: ReadonlySet<CheckId> = new Set();
const RECORDER_MESSAGES = {
  unsupported: 'Ce navigateur ne sait pas enregistrer de vidéo.',
  failed: 'L’enregistrement n’a pas pu démarrer. Réessaie.',
};

function ThirdsGrid() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 size-full text-paper/30"
      viewBox="0 0 3 3"
      preserveAspectRatio="none"
    >
      {[1, 2].map((n) => (
        <g key={n} stroke="currentColor" strokeWidth="1">
          <line x1={n} y1={0} x2={n} y2={3} vectorEffect="non-scaling-stroke" />
          <line x1={0} y1={n} x2={3} y2={n} vectorEffect="non-scaling-stroke" />
        </g>
      ))}
    </svg>
  );
}

/**
 * Écran du Coach, façon appareil photo : la caméra en plein cadre, de petits voyants, la consigne
 * au centre, un bouton d'enregistrement.
 *
 * Mode réel : les voyants viennent des mesures du téléphone (inclinaison, image, visage), comparées
 * aux cibles du plan reçues en paramètre (`targets`). Mode démo : les consignes défilent toutes seules,
 * valeurs simulées.
 */
export function CoachScreen({
  onClose,
  targets,
  shotLabel,
  shotNote,
  timeline,
  initialMount = DEFAULT_MOUNT,
  onMountChange,
}: {
  onClose: () => void;
  /** Cibles chiffrées du plan à filmer (celles du plan, éventuellement modifié par l'utilisateur). */
  targets: Targets;
  shotLabel?: string;
  /** Étiquette écrite par l'utilisateur pour un plan en mouvement (ce qu'il va filmer). */
  shotNote?: string;
  /** Plan en mouvement : les passages, comptés en secondes depuis le début de la prise. */
  timeline?: Timeline;
  /** Montage du téléphone sur une vraie caméra, choisi avant de filmer. */
  initialMount?: Mount;
  onMountChange?: (mount: Mount) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [attempt, setAttempt] = useState(0);
  const camera = useCamera(videoRef, true, attempt);
  const stream = camera.status === 'live' ? camera.stream : null;
  const settings = useCameraSettings(stream);
  const [retouch, setRetouch] = useState(false);
  const [adjust, setAdjust] = useState<Adjust>(NEUTRAL);
  const [webgl] = useState(isWebGLAvailable);
  const { canvasRef, getStream: pipelineStream } = useImagePipeline(
    videoRef,
    retouch && stream !== null,
    adjust,
  );
  // Ce qu'on filme : la caméra directe, ou l'image retouchée si la retouche est active.
  const getStream = useCallback(
    () => (retouch ? pipelineStream() : stream),
    [retouch, pipelineStream, stream],
  );
  const getVideo = useCallback(() => videoRef.current, []);
  const recorder = useRecorder(getStream, getVideo);
  // Plan en mouvement : les secondes se comptent depuis le début de l'enregistrement (ou d'une répétition).
  const recStartedAt = recorder.state.status === 'recording' ? recorder.state.startedAt : null;
  const clock = useShotClock(timeline?.duration_s ?? null, recStartedAt);
  const { getElapsed } = clock;
  const timedTargets = useCallback(
    () => (timeline ? targetsAt(timeline, getElapsed() ?? 0) : targets),
    [timeline, targets, getElapsed],
  );
  const [quality, setQuality] = useState<'1080' | '720'>('1080');
  const changeQuality = (q: '1080' | '720') => {
    setQuality(q);
    const [width, height] = q === '1080' ? [1920, 1080] : [1280, 720];
    void stream
      ?.getVideoTracks()[0]
      ?.applyConstraints({ width: { ideal: width }, height: { ideal: height }, frameRate: { ideal: 30 } })
      .catch(() => undefined);
  };

  const [mode, setMode] = useState<'live' | 'demo'>('live');
  const demo = mode === 'demo';
  const [readings, setReadings] = useState<Readings>(allOkReadings); // état des voyants en démo
  const [ignored, setIgnored] = useState<ReadonlySet<CheckId>>(new Set());
  const [hud, setHud] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [mount, setMount] = useState<Mount>(initialMount);
  const changeMount = (next: Mount) => {
    setMount(next);
    onMountChange?.(next);
  };
  // Valeurs lues par les capteurs sans les recréer à chaque changement.
  const mountRef = useRef(mount);
  const adjustRef = useRef<Adjust | null>(null);
  useEffect(() => {
    mountRef.current = mount;
    adjustRef.current = retouch ? adjust : null;
  }, [mount, retouch, adjust]);
  const getAdjust = useCallback(() => adjustRef.current, []);
  const [auto, setAuto] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const apply = useCallback((next: Readings) => {
    setReadings(next);
    setShowWhy(false);
    setIgnored((prev) => {
      const kept = [...prev].filter((id) => !next[id].ok);
      return kept.length === prev.size ? prev : new Set(kept);
    });
  }, []);
  useAutoDemo(demo && auto, apply, setLeaving);

  // Mesures réelles : inclinaison (capteurs), image (luminosité...), visage (MediaPipe).
  const orientation = useOrientation(!demo);
  const readOrientation = useCallback(() => {
    const o = orientation.read();
    // Montage sur caméra : l'angle du téléphone est corrigé pour donner celui de la caméra.
    return o ? { ...o, pitch: correctPitch(o.pitch, mountRef.current) } : null;
  }, [orientation]);
  const measuring = !demo && stream !== null;
  const face = useFaceDetector(videoRef, measuring);
  const frame = useFrameStats(videoRef, measuring, face.read, getAdjust);
  const live = useLiveReadings(
    !demo,
    timeline ? timedTargets : targets,
    { orientation: readOrientation, frame: frame.read, face: face.read },
    (id) =>
      setIgnored((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      }),
  );

  const shown = demo ? readings : live.readings;
  const instruction = pickInstruction(shown, ignored);
  const recording = recorder.state.status === 'recording';
  const done = recorder.state.status === 'done' ? recorder.state : null;

  const switchMode = () => {
    setLeaving(false);
    setShowWhy(false);
    setReadings(allOkReadings());
    setIgnored(new Set());
    setAuto(true);
    setMode(demo ? 'live' : 'demo');
  };

  const toggleDot = (id: CheckId) => {
    setAuto(false);
    setLeaving(false);
    apply({ ...readings, [id]: flipReading(id, readings[id]) });
  };

  const close = useCallback(() => {
    if (done && !window.confirm('Quitter sans enregistrer la vidéo ?')) return;
    onClose();
  }, [done, onClose]);

  // Plein écran : bloque le défilement, Échap ferme, le focus va sur « Fermer ».
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [close]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={shotLabel ? `Coach de cadrage : ${shotLabel}` : 'Coach de cadrage'}
      className="fixed inset-0 z-50 flex flex-col bg-ink text-paper"
    >
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        className={`absolute inset-0 size-full object-cover ${retouch ? 'opacity-0' : ''}`}
      />
      {retouch ? <canvas ref={canvasRef} className="absolute inset-0 size-full object-cover" /> : null}
      <ThirdsGrid />

      <header className="relative grid grid-cols-[44px_1fr_56px] items-start px-2 pt-[max(0.25rem,env(safe-area-inset-top))]">
        <Button
          ref={closeRef}
          variant="ghost"
          size="sm"
          icon="x"
          aria-label="Fermer le Coach"
          className="px-0 text-paper hover:bg-paper/10"
          onClick={close}
        />
        <div className="flex flex-col items-center">
          <CheckDots
            readings={shown}
            unmeasured={demo ? NONE : live.unmeasured}
            notApplicable={demo ? NONE : live.notApplicable}
            interactive={demo}
            onToggle={toggleDot}
          />
          <button
            type="button"
            onClick={switchMode}
            className={`-mt-1 min-h-6 text-label text-paper/80 underline-offset-2 hover:underline ${SHADOW}`}
          >
            {demo ? 'Démo : valeurs simulées · passer en mode réel' : 'Mode réel · passer en démo'}
          </button>
        </div>
        <p
          role="timer"
          aria-label="Durée de l’enregistrement"
          className={`flex h-11 items-center justify-end gap-1 font-mono text-label text-paper ${SHADOW}`}
        >
          {recorder.state.status === 'recording' ? (
            <>
              <span className="size-2 rounded-full bg-brand-red" />
              {formatDuration(recorder.state.seconds)}
            </>
          ) : null}
        </p>
      </header>

      <div className="relative flex-1">
        {camera.status === 'starting' ? (
          <p role="status" className={`absolute inset-x-0 top-4 text-center text-paper ${SHADOW}`}>
            Ouverture de la caméra…
          </p>
        ) : camera.status === 'error' ? (
          <div
            role="alert"
            className="absolute inset-x-4 top-4 mx-auto max-w-sm border-2 border-gold bg-ink/90 p-4"
          >
            <p className="font-display text-h3 font-bold">Caméra indisponible</p>
            <p className="mt-2 text-meta">{CAMERA_MESSAGES[camera.error]}</p>
            <Button className="mt-3" variant="on-dark" size="sm" onClick={() => setAttempt((n) => n + 1)}>
              Réessayer
            </Button>
            <p className="mt-3 text-meta text-muted-on-dark">
              Tu peux quand même tester les voyants et les consignes en mode démo.
            </p>
          </div>
        ) : null}
        {!demo && !hud ? <LiveReadout m={live.measurements} /> : null}
        {timeline && !demo ? (
          <TimelineStrip
            timeline={timeline}
            phase={clock.phase}
            elapsed={clock.elapsed}
            recording={recording}
            rehearsing={clock.rehearsing}
            onRehearse={clock.startRehearsal}
            onStopRehearse={clock.stopRehearsal}
          />
        ) : null}
        {hud ? (
          <MeasurementsHud
            m={live.measurements}
            faceStatus={face.status}
            mountNote={
              mount.kind === 'phone'
                ? undefined
                : `${mount.kind === 'above' ? 'au-dessus' : 'sous'} la caméra, ${describeTilt(mount.tiltDeg)}`
            }
          />
        ) : null}
        {webgl ? (
          <QuickAdjust
            open={quickOpen}
            onOpenChange={setQuickOpen}
            adjust={adjust}
            locked={recording && !retouch}
            onChange={(key, value) => {
              if (!retouch && !recording) setRetouch(true); // bouger un curseur active la retouche
              setAdjust((a) => ({ ...a, [key]: value }));
            }}
            onReset={() =>
              setAdjust((a) => ({ ...a, contrast: NEUTRAL.contrast, temperature: NEUTRAL.temperature }))
            }
          />
        ) : null}
        <InstructionOverlay instruction={instruction} leaving={leaving} showWhy={showWhy} />
        {recorder.error || recorder.micDenied ? (
          <p role="alert" className={`absolute inset-x-4 top-2 text-center text-meta text-gold ${SHADOW}`}>
            {recorder.error
              ? RECORDER_MESSAGES[recorder.error]
              : 'Micro refusé : la vidéo sera enregistrée sans le son.'}
          </p>
        ) : null}
        <div className="absolute inset-x-3 bottom-2 flex flex-col gap-2">
          {settingsOpen ? (
            <SettingsSheet
              items={settings.items}
              missing={settings.missing}
              exposed={settings.exposed}
              highlight={LIGHT_SETTINGS}
              onRange={settings.setRange}
              onSwitch={settings.setSwitch}
              retouch={{ on: retouch, supported: webgl, locked: recording, adjust }}
              quality={{ value: quality, locked: recording }}
              onQuality={changeQuality}
              mount={mount}
              onMount={changeMount}
              hud={hud}
              onHud={setHud}
              highlightAdjust={LIGHT_ADJUST}
              onRetouchToggle={setRetouch}
              onAdjust={(key, value) => setAdjust((a) => ({ ...a, [key]: value }))}
              onReset={() => {
                setAdjust(NEUTRAL);
                settings.reset();
              }}
              onClose={() => setSettingsOpen(false)}
            />
          ) : null}
          {done ? <RecordingSheet done={done} onDiscard={recorder.discard} /> : null}
        </div>
      </div>

      <footer className="relative px-3 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <CoachControls
          demo={demo}
          auto={auto}
          recording={recording}
          hasInstruction={instruction !== null}
          lightInstruction={
            instruction?.check.id === 'light' ||
            instruction?.check.id === 'contrast' ||
            instruction?.check.id === 'backlight'
          }
          showWhy={showWhy}
          onToggleAuto={() => {
            setLeaving(false);
            setShowWhy(false);
            setAuto((a) => !a);
          }}
          onToggleRecord={() => (recording ? recorder.stop() : void recorder.start())}
          onSettings={() => setSettingsOpen((v) => !v)}
          onFix={() =>
            instruction?.check.id === 'contrast' && webgl ? setQuickOpen(true) : setSettingsOpen(true)
          }
          onWhy={() => {
            setAuto(false);
            setLeaving(false);
            setShowWhy((v) => !v);
          }}
          onIgnore={() => instruction && setIgnored((prev) => new Set(prev).add(instruction.check.id))}
        />
        <p className={`mt-1 text-center text-label text-paper/70 ${SHADOW}`}>
          {shotLabel ? `${shotLabel} · ` : ''}
          {shotNote ? `« ${shotNote} » · ` : ''}La vidéo reste sur ton téléphone. Rien n’est envoyé.
        </p>
      </footer>
    </div>,
    document.body,
  );
}
