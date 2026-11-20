import { createContext, useContext } from 'react';

export interface DeckEnv {
  /** Animations réduites (préférence système ou touche M) : les états apparaissent sans mouvement */
  reduced: boolean;
  /** Rendu statique (export PDF / vidéo) : chaque scène s'affiche directement à l'étape demandée */
  print: boolean;
  /** Échelle courante de la scène 1920 × 1080 (pour convertir des mesures écran) */
  scale: number;
}

export const DeckEnvContext = createContext<DeckEnv>({ reduced: false, print: false, scale: 1 });
export const useDeckEnv = () => useContext(DeckEnvContext);

/** Largeur et hauteur de la scène logique (16:9) */
export const STAGE_W = 1920;
export const STAGE_H = 1080;
