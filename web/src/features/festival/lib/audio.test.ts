import { describe, expect, it } from 'vitest';
import { encodeWav, wavName } from './audio';

describe('extraction audio : WAV mono 16 kHz', () => {
  it('écrit un en-tête WAV PCM 16 bits mono', async () => {
    const blob = encodeWav(new Float32Array([0, 1, -1, 0.5]), 16_000);
    const v = new DataView(await blob.arrayBuffer());
    const tag = (o: number) => String.fromCharCode(...[0, 1, 2, 3].map((i) => v.getUint8(o + i)));
    expect(blob.type).toBe('audio/wav');
    expect(tag(0)).toBe('RIFF');
    expect(tag(8)).toBe('WAVE');
    expect(v.getUint16(22, true)).toBe(1); // mono
    expect(v.getUint32(24, true)).toBe(16_000);
    expect(v.getUint16(34, true)).toBe(16);
    expect(v.getUint32(40, true)).toBe(8); // 4 échantillons × 2 octets
    expect(v.getInt16(46, true)).toBe(0x7fff);
    expect(v.getInt16(48, true)).toBe(-0x8000);
  });
  it('renomme le fichier en .wav', () => {
    expect(wavName('Dar Hmeti v3.mov')).toBe('Dar Hmeti v3.wav');
  });
});
