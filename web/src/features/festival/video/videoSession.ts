import { createContext, useContext } from 'react';

export type VideoSession = {
  file: File | null;
  /** URL objet (`blob:`) à donner au `<video>`, ou null sans vidéo. */
  url: string | null;
  setFile: (file: File | null) => void;
};

export const VideoSessionContext = createContext<VideoSession | null>(null);

/** Vidéo choisie pour la relecture (voir VideoSessionProvider). */
export function useVideoSession(): VideoSession {
  const v = useContext(VideoSessionContext);
  if (!v) throw new Error('useVideoSession doit être utilisé dans VideoSessionProvider.');
  return v;
}
