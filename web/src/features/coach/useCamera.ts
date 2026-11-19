import { useEffect, useState, type RefObject } from 'react';

export type CameraError = 'insecure' | 'unsupported' | 'denied' | 'notfound' | 'other';
export type CameraState =
  { status: 'starting' } | { status: 'live'; stream: MediaStream } | { status: 'error'; error: CameraError };

export const CAMERA_MESSAGES: Record<CameraError, string> = {
  insecure:
    'La caméra exige une connexion sécurisée (HTTPS). Ouvre l’application avec une adresse qui commence par https://.',
  unsupported: 'Ton navigateur ne permet pas d’ouvrir la caméra ici.',
  denied:
    'L’accès à la caméra est refusé. Autorise-la dans les réglages du navigateur (sur iPhone : Réglages, Safari, Caméra), puis réessaie.',
  notfound: 'Aucune caméra détectée sur cet appareil.',
  other: 'La caméra n’a pas pu s’ouvrir. Ferme les autres applications qui l’utilisent, puis réessaie.',
};

function classify(e: unknown): CameraError {
  const name = e instanceof DOMException ? e.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'notfound';
  return 'other';
}

/**
 * Ouvre la caméra arrière dans `videoRef` tant que `active` est vrai, puis la libère.
 * Les images restent dans le téléphone : rien n'est enregistré ni envoyé.
 * `attempt` : changer sa valeur relance l'ouverture (bouton « Réessayer »).
 */
export function useCamera(
  videoRef: RefObject<HTMLVideoElement | null>,
  active: boolean,
  attempt = 0,
): CameraState {
  const [state, setState] = useState<CameraState>({ status: 'starting' });

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let wakeLock: WakeLockSentinel | null = null;
    const videoEl = videoRef.current;

    const fail = (error: CameraError) => {
      if (!cancelled) setState({ status: 'error', error });
    };

    async function start() {
      setState({ status: 'starting' });
      if (!window.isSecureContext) return fail('insecure');
      if (!navigator.mediaDevices?.getUserMedia) return fail('unsupported');
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoEl) {
          videoEl.srcObject = stream;
          await videoEl.play().catch(() => undefined); // iOS exige muted + playsInline (posés sur <video>)
        }
        setState({ status: 'live', stream });
        // Garde l'écran allumé pendant la prise (facultatif : ignoré si non supporté).
        wakeLock = (await navigator.wakeLock?.request('screen').catch(() => null)) ?? null;
      } catch (e) {
        fail(classify(e));
      }
    }
    void start();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      void wakeLock?.release().catch(() => undefined);
      if (videoEl) videoEl.srcObject = null;
    };
  }, [videoRef, active, attempt]);

  return state;
}
