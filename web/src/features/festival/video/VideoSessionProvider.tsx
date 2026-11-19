/**
 * Vidéo du film choisie pour la relecture des sous-titres.
 * Lue par le navigateur, jamais envoyée ni stockée : le fichier et son URL objet restent en mémoire
 * pour toute la session de l'onglet (on ne la rechoisit plus en naviguant), et sont oubliés au
 * rechargement. L'URL précédente est libérée quand on change de vidéo.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { VideoSessionContext } from './videoSession';

export function VideoSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ file: File | null; url: string | null }>({ file: null, url: null });
  const current = useRef<string | null>(null);

  const setFile = useCallback((file: File | null) => {
    if (current.current) URL.revokeObjectURL(current.current);
    const url = file ? URL.createObjectURL(file) : null;
    current.current = url;
    setState({ file, url });
  }, []);

  useEffect(
    () => () => {
      if (current.current) URL.revokeObjectURL(current.current);
    },
    [],
  );

  const value = useMemo(() => ({ ...state, setFile }), [state, setFile]);
  return <VideoSessionContext.Provider value={value}>{children}</VideoSessionContext.Provider>;
}
