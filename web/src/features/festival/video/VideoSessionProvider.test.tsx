import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VideoSessionProvider } from './VideoSessionProvider';
import { useVideoSession, type VideoSession } from './videoSession';

describe('vidéo gardée pour la session de l’onglet', () => {
  afterEach(() => vi.restoreAllMocks());

  it('crée une URL objet, la garde, et libère l’ancienne au changement et à la fermeture', () => {
    let n = 0;
    const create = vi.fn(() => `blob:test-${++n}`);
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    let session: VideoSession | null = null;
    function Probe() {
      session = useVideoSession();
      return null;
    }
    const { unmount } = render(
      <VideoSessionProvider>
        <Probe />
      </VideoSessionProvider>,
    );
    expect(session!.url).toBeNull();
    act(() => session!.setFile(new File(['a'], 'film.mp4', { type: 'video/mp4' })));
    expect(session!.url).toBe('blob:test-1');
    expect(session!.file?.name).toBe('film.mp4');
    act(() => session!.setFile(new File(['b'], 'v2.mp4', { type: 'video/mp4' })));
    expect(revoke).toHaveBeenCalledWith('blob:test-1');
    expect(session!.url).toBe('blob:test-2');
    unmount();
    expect(revoke).toHaveBeenCalledWith('blob:test-2');
  });
});
