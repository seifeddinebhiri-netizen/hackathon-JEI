import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RecordingSheet } from './RecordingSheet';

const done = {
  status: 'done' as const,
  url: 'blob:test',
  blob: new Blob(['x'], { type: 'video/mp4;codecs=avc1' }),
  seconds: 12,
  extension: 'mp4' as const,
  info: { mime: 'video/mp4;codecs=avc1', width: 1920, height: 1080, fps: 29.8 },
};

function stubShare(canShare: boolean, share = vi.fn().mockResolvedValue(undefined)) {
  Object.defineProperty(navigator, 'canShare', { value: () => canShare, configurable: true });
  Object.defineProperty(navigator, 'share', { value: share, configurable: true });
  return share;
}

describe('RecordingSheet', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'canShare');
    Reflect.deleteProperty(navigator, 'share');
  });

  it('toujours : télécharger et supprimer ; le diagnostic est affiché', () => {
    stubShare(false);
    render(<RecordingSheet done={done} onDiscard={() => undefined} />);
    expect(screen.getByRole('link', { name: 'Enregistrer la vidéo' })).toHaveAttribute('href', 'blob:test');
    expect(screen.getByText(/1920×1080 · 29.8 i\/s reçues de la caméra · mp4 · H.264/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ajouter à Photos/ })).toBeNull();
  });

  it('partage le fichier (sans « ;codecs ») quand le téléphone le permet', async () => {
    const share = stubShare(true);
    render(<RecordingSheet done={done} onDiscard={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter à Photos / Partager' }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    const [{ files }] = share.mock.calls[0];
    expect(files[0].type).toBe('video/mp4');
    expect(files[0].name).toMatch(/^plan-.*\.mp4$/);
  });

  it('un partage annulé n’affiche pas d’erreur, un vrai échec oui', async () => {
    stubShare(true, vi.fn().mockRejectedValue(new DOMException('annulé', 'AbortError')));
    const { unmount } = render(<RecordingSheet done={done} onDiscard={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter à Photos / Partager' }));
    await waitFor(() => expect(navigator.share).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).toBeNull();
    unmount();

    stubShare(true, vi.fn().mockRejectedValue(new Error('boom')));
    render(<RecordingSheet done={done} onDiscard={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter à Photos / Partager' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Le partage n’a pas pu s’ouvrir');
  });
});
