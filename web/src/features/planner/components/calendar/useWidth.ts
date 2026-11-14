import { useEffect, useRef, useState } from 'react';

/** Largeur d'un élément, suivie avec ResizeObserver. */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

let canvas: HTMLCanvasElement | null = null;
/** Largeur d'un texte en px (police des bandes : Inter 600 13 px). */
export function textWidth(text: string, font = '600 13px Inter, sans-serif'): number {
  canvas ??= document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return text.length * 7.5;
  ctx.font = font;
  return ctx.measureText(text).width;
}
