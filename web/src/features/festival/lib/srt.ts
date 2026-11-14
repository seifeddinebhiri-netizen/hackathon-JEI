import type { SubtitleLine } from '@/api/types';

/** Fichier .srt à partir des lignes validées (langue cible : fr ou en). */
export function toSrt(lines: SubtitleLine[], lang: 'fr' | 'en'): string {
  return (
    lines
      .map((l, i) => `${i + 1}\n${l.start} --> ${l.end}\n${(lang === 'fr' ? l.fr : (l.en ?? '')).trim()}`)
      .join('\n\n') + '\n'
  );
}

export function allValidated(lines: SubtitleLine[]): boolean {
  return lines.length > 0 && lines.every((l) => l.validated);
}
