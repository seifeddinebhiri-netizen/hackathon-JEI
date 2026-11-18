import { useCallback, useEffect, useRef, useState } from 'react';

// H.264 d'abord (encodé par la puce du téléphone, donc fluide), puis VP8, et VP9 en dernier :
// le VP9 est souvent encodé par logiciel et fait perdre des images en 1080p.
const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=h264,opus',
  'video/webm;codecs=h264',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9,opus',
  'video/webm',
];

/** Nom lisible du format choisi (pour le diagnostic). */
export function describeMime(mime: string): string {
  const container = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
  const codec =
    /h264|avc1/.test(mime) || mime === 'video/mp4'
      ? 'H.264'
      : /vp9/.test(mime)
        ? 'VP9'
        : /vp8/.test(mime)
          ? 'VP8'
          : '';
  return codec ? `${container} · ${codec}` : container;
}

/** Premier format que le navigateur sait enregistrer (mp4 sur iPhone, webm sur Android). */
export function pickMimeType(isSupported: (mime: string) => boolean): string | null {
  return MIME_CANDIDATES.find((m) => isSupported(m)) ?? null;
}

export function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export type RecorderState =
  | { status: 'idle' }
  /** `startedAt` : instant précis du départ (performance.now()) : sert à compter les secondes d'un plan. */
  | { status: 'recording'; seconds: number; startedAt: number }
  | {
      status: 'done';
      url: string;
      /** La vidéo elle-même, pour le menu de partage du téléphone. */
      blob: Blob;
      seconds: number;
      extension: 'mp4' | 'webm';
      /** Diagnostic : format, taille de l'image et cadence réellement reçue de la caméra. */
      info: { mime: string; width: number; height: number; fps: number | null };
    };

export type RecorderError = 'unsupported' | 'failed';

/**
 * Enregistre la vidéo de la caméra (sans les consignes affichées par-dessus).
 * `getStream` donne le flux à filmer au moment du départ : la caméra directe, ou le flux retouché.
 * La vidéo reste dans la mémoire du téléphone : elle n'est jamais envoyée, et l'utilisateur
 * choisit de l'enregistrer ou de la supprimer. Le micro n'est demandé qu'au premier enregistrement.
 */
export function useRecorder(getStream: () => MediaStream | null, getVideo: () => HTMLVideoElement | null) {
  const [state, setState] = useState<RecorderState>({ status: 'idle' });
  const [error, setError] = useState<RecorderError | null>(null);
  const [micDenied, setMicDenied] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const audio = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const urlRef = useRef<string | null>(null);

  const cleanupLive = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    audio.current?.getTracks().forEach((t) => t.stop());
    audio.current = null;
  }, []);

  const discard = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setState({ status: 'idle' });
  }, []);

  const start = useCallback(async () => {
    setError(null);
    const stream = getStream();
    if (!stream || typeof MediaRecorder === 'undefined') return setError('unsupported');
    const mime = pickMimeType((m) => MediaRecorder.isTypeSupported(m));
    if (!mime) return setError('unsupported');
    discard();

    const tracks = [...stream.getVideoTracks()];
    try {
      audio.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      tracks.push(...audio.current.getAudioTracks());
      setMicDenied(false);
    } catch {
      setMicDenied(true); // on filme quand même, sans le son
    }

    try {
      const rec = new MediaRecorder(new MediaStream(tracks), {
        mimeType: mime,
        videoBitsPerSecond: 8_000_000,
      });
      const chunks: Blob[] = [];
      const startedAt = Date.now();
      // Compte les images réellement reçues de la caméra pendant la prise (cadence mesurée).
      const video = getVideo();
      let frames = 0;
      let frameHandle = 0;
      const countFrame = () => {
        frames += 1;
        frameHandle = video!.requestVideoFrameCallback(countFrame);
      };
      if (video && 'requestVideoFrameCallback' in video)
        frameHandle = video.requestVideoFrameCallback(countFrame);
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
      rec.onstop = () => {
        const elapsed = (Date.now() - startedAt) / 1000;
        const seconds = Math.round(elapsed);
        if (video && 'cancelVideoFrameCallback' in video) video.cancelVideoFrameCallback(frameHandle);
        cleanupLive();
        const blob = new Blob(chunks, { type: mime });
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        setState({
          status: 'done',
          url,
          blob,
          seconds,
          extension: mime.startsWith('video/mp4') ? 'mp4' : 'webm',
          info: {
            mime,
            width: video?.videoWidth ?? 0,
            height: video?.videoHeight ?? 0,
            fps: frameHandle && elapsed > 0 ? Math.round((frames / elapsed) * 10) / 10 : null,
          },
        });
      };
      rec.start(1000);
      recorder.current = rec;
      const clockStart = performance.now();
      setState({ status: 'recording', seconds: 0, startedAt: clockStart });
      timer.current = setInterval(
        () =>
          setState({
            status: 'recording',
            seconds: Math.floor((Date.now() - startedAt) / 1000),
            startedAt: clockStart,
          }),
        1000,
      );
    } catch {
      cleanupLive();
      setError('failed');
    }
  }, [getStream, getVideo, discard, cleanupLive]);

  const stop = useCallback(() => {
    if (recorder.current?.state === 'recording') recorder.current.stop();
  }, []);

  // À la fermeture : arrête tout et libère la vidéo non enregistrée.
  useEffect(
    () => () => {
      if (recorder.current?.state === 'recording') {
        recorder.current.onstop = null;
        recorder.current.stop();
      }
      cleanupLive();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [cleanupLive],
  );

  return { state, error, micDenied, start, stop, discard };
}
