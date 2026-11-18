import { describe, expect, it } from 'vitest';
import { describeMime, formatDuration, pickMimeType } from './useRecorder';

describe('enregistrement', () => {
  it('choisit mp4 quand il est supporté (iPhone), sinon webm (Android)', () => {
    expect(pickMimeType((m) => m.startsWith('video/mp4'))).toBe('video/mp4;codecs=avc1');
    expect(pickMimeType((m) => m === 'video/webm;codecs=vp9,opus')).toBe('video/webm;codecs=vp9,opus');
    expect(pickMimeType(() => false)).toBeNull();
  });

  it('préfère H.264 à VP9 (VP9 saccade sur beaucoup de téléphones)', () => {
    const webmOnly = (m: string) => m.startsWith('video/webm');
    expect(pickMimeType(webmOnly)).toBe('video/webm;codecs=h264,opus');
    expect(pickMimeType((m) => m.includes('vp8') || m.includes('vp9'))).toBe('video/webm;codecs=vp8,opus');
  });

  it('décrit le format en clair', () => {
    expect(describeMime('video/mp4;codecs=avc1')).toBe('mp4 · H.264');
    expect(describeMime('video/webm;codecs=vp9,opus')).toBe('webm · VP9');
    expect(describeMime('video/webm')).toBe('webm');
  });

  it('formate la durée en mm:ss', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(75)).toBe('01:15');
    expect(formatDuration(3599)).toBe('59:59');
  });
});
