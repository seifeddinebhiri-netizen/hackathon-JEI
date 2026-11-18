/**
 * Extraction du son dans le navigateur : la vidéo reste sur l'ordinateur,
 * seul un WAV mono 16 kHz est envoyé pour la transcription.
 */
export const TARGET_RATE = 16_000;

/** PCM 16 bits mono → fichier WAV (en-tête RIFF de 44 octets). */
export function encodeWav(samples: Float32Array, sampleRate = TARGET_RATE): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buffer);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true); // taille du bloc fmt
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true); // octets par seconde
  v.setUint16(32, 2, true); // octets par échantillon
  v.setUint16(34, 16, true); // bits par échantillon
  str(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

export class AudioExtractError extends Error {}

/** Vidéo ou audio choisi par l'utilisateur → WAV mono 16 kHz (decodeAudioData + OfflineAudioContext). */
export async function extractAudioWav(file: File): Promise<Blob> {
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC || typeof OfflineAudioContext === 'undefined')
    throw new AudioExtractError(
      'Ton navigateur ne sait pas extraire le son. Essaie avec Chrome, Edge ou Firefox.',
    );
  const ctx = new AC();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(await file.arrayBuffer());
  } catch {
    throw new AudioExtractError(
      'Impossible de lire le son de ce fichier. Essaie un export .mp4 (H.264 + AAC) ou un fichier audio.',
    );
  } finally {
    void ctx.close();
  }
  const length = Math.ceil(decoded.duration * TARGET_RATE);
  if (!length) throw new AudioExtractError('Ce fichier ne contient pas de son.');
  // Le mixage vers 1 canal et le rééchantillonnage sont faits par le navigateur.
  const offline = new OfflineAudioContext(1, length, TARGET_RATE);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();
  const rendered = await offline.startRendering();
  return encodeWav(rendered.getChannelData(0), TARGET_RATE);
}

/** « film final.mov » → « film final.wav » */
export function wavName(fileName: string): string {
  return `${fileName.replace(/\.[^.]+$/, '') || 'son'}.wav`;
}
