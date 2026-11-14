import { KeyboardCode, type KeyboardCoordinateGetter } from '@dnd-kit/core';

/**
 * Déplacement au clavier entre les cases du calendrier : chaque flèche saute à la case la plus proche
 * dans cette direction (au lieu de déplacer de quelques pixels).
 */
export const jumpToDroppable: KeyboardCoordinateGetter = (event, { context }) => {
  const { collisionRect, droppableRects, droppableContainers, active } = context;
  if (!collisionRect || !active) return undefined;
  const dir =
    event.code === KeyboardCode.Right
      ? 'r'
      : event.code === KeyboardCode.Left
        ? 'l'
        : event.code === KeyboardCode.Down
          ? 'd'
          : event.code === KeyboardCode.Up
            ? 'u'
            : null;
  if (!dir) return undefined;
  event.preventDefault();
  const cx = collisionRect.left + collisionRect.width / 2;
  const cy = collisionRect.top + collisionRect.height / 2;
  let best: { x: number; y: number; dist: number } | undefined;
  for (const c of droppableContainers.getEnabled()) {
    const r = droppableRects.get(c.id);
    if (!r) continue;
    const x = r.left + r.width / 2;
    const y = r.top + Math.min(r.height / 2, 40);
    const dx = x - cx;
    const dy = y - cy;
    const ok = dir === 'r' ? dx > 10 : dir === 'l' ? dx < -10 : dir === 'd' ? dy > 10 : dy < -10;
    if (!ok) continue;
    // privilégie l'axe demandé
    const dist =
      dir === 'r' || dir === 'l' ? Math.abs(dx) + Math.abs(dy) * 3 : Math.abs(dy) + Math.abs(dx) * 3;
    if (!best || dist < best.dist) best = { x, y, dist };
  }
  if (!best) return undefined;
  return { x: best.x - collisionRect.width / 2, y: best.y - collisionRect.height / 2 };
};
