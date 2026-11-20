import { createContext, useContext, useEffect, useRef } from 'react';

/**
 * Une scène peut intercepter le clavier (ex. Échap ferme une fiche, flèches dans la démo).
 * Le gestionnaire renvoie true s'il a consommé la touche : la navigation de la présentation l'ignore alors.
 */
export type KeyHandler = (e: KeyboardEvent) => boolean;
export type RegisterKeys = (h: KeyHandler | null) => void;

export const KeyCaptureContext = createContext<RegisterKeys>(() => {});

export function useKeyCapture(handler: KeyHandler | null) {
  const register = useContext(KeyCaptureContext);
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => {
    register((e) => (latest.current ? latest.current(e) : false));
    return () => register(null);
  }, [register]);
}
