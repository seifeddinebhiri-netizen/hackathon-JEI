import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { pickMainFace } from './face';
import type { Box } from './imageStats';

export type FaceStatus = 'idle' | 'loading' | 'ready' | 'error';

const INTERVAL_MS = 100; // environ 10 détections par seconde
const STALE_MS = 600; // un visage non revu depuis ce délai est considéré comme sorti du cadre

/**
 * Détecte le visage principal (MediaPipe BlazeFace, entièrement sur l'appareil : le moteur et le
 * modèle sont servis par notre site, aucun réseau externe). Détection de POSITION seulement :
 * pas de reconnaissance, aucune identification, rien n'est stocké.
 */
export function useFaceDetector(videoRef: RefObject<HTMLVideoElement | null>, active: boolean) {
  const [status, setStatus] = useState<FaceStatus>('idle');
  const face = useRef<{ box: Box; at: number } | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let close: (() => void) | undefined;

    async function start() {
      setStatus('loading');
      try {
        // Chargé à la demande : le moteur (≈ 15 Mo) ne pèse que sur l'écran du Coach.
        const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision');
        const fileset = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
        const create = (delegate: 'GPU' | 'CPU') =>
          FaceDetector.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: '/models/blaze_face_short_range.tflite', delegate },
            runningMode: 'VIDEO',
            minDetectionConfidence: 0.5,
          });
        const detector = await create('GPU').catch(() => create('CPU')); // repli si le GPU échoue
        if (cancelled) return detector.close();
        close = () => detector.close();
        setStatus('ready');

        timer = setInterval(() => {
          const video = videoRef.current;
          if (!video || video.readyState < 2 || video.videoWidth === 0) return;
          const { detections } = detector.detectForVideo(video, performance.now());
          const boxes: Box[] = detections.flatMap((d) =>
            d.boundingBox
              ? [
                  {
                    x: d.boundingBox.originX / video.videoWidth,
                    y: d.boundingBox.originY / video.videoHeight,
                    w: d.boundingBox.width / video.videoWidth,
                    h: d.boundingBox.height / video.videoHeight,
                  },
                ]
              : [],
          );
          const main = pickMainFace(boxes);
          if (main) face.current = { box: main, at: performance.now() };
        }, INTERVAL_MS);
      } catch {
        if (!cancelled) setStatus('error');
      }
    }
    void start();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      close?.();
      face.current = null;
    };
  }, [videoRef, active]);

  /** Le visage vu il y a moins de 0,6 s, sinon null. */
  const read = useCallback((): Box | null => {
    const f = face.current;
    return f && performance.now() - f.at < STALE_MS ? f.box : null;
  }, []);

  return { status, read };
}
