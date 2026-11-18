import type { SubtitleLine } from '@/api/types';
import { downloadBlob } from '@/lib/print';

export type SrtLang = 'fr' | 'en';

/** "00:00:12,400" → 12.4 (secondes). */
export function srtToSeconds(value: string): number {
  const m = /^(\d{2}):(\d{2}):(\d{2}),(\d{3})$/.exec(value.trim());
  if (!m) return NaN;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 1000;
}

/** 12.4 → "00:00:12,400". */
export function secondsToSrt(total: number): string {
  const ms = Math.max(0, Math.round(total * 1000));
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor(ms / 60_000) % 60)}:${pad(
    Math.floor(ms / 1000) % 60,
  )},${pad(ms % 1000, 3)}`;
}

/** Texte d'une ligne dans la langue du fichier. */
export function lineText(l: SubtitleLine, lang: SrtLang): string {
  return (lang === 'fr' ? l.fr : (l.en ?? '')).trim();
}

/** Fichier .srt à partir des lignes validées (langue cible : fr ou en). */
export function toSrt(lines: SubtitleLine[], lang: SrtLang): string {
  return lines.map((l, i) => `${i + 1}\n${l.start} --> ${l.end}\n${lineText(l, lang)}`).join('\n\n') + '\n';
}

export function allValidated(lines: SubtitleLine[]): boolean {
  return lines.length > 0 && lines.every((l) => l.validated);
}

/**
 * Pourquoi l'export est verrouillé (null : export possible).
 * Toutes les lignes doivent être validées et avoir un texte dans la langue du fichier.
 */
export function exportBlocker(lines: SubtitleLine[], lang: SrtLang): string | null {
  if (!lines.length) return 'Aucune ligne à exporter.';
  const left = lines.filter((l) => !l.validated).length;
  if (left) {
    return left === 1
      ? 'Export possible quand la dernière ligne est validée.'
      : `Export possible quand les ${lines.length} lignes sont validées (${left} à valider).`;
  }
  const empty = lines.filter((l) => !lineText(l, lang)).length;
  if (empty)
    return `${empty} ligne${empty > 1 ? 's n’ont' : ' n’a'} pas de texte ${lang === 'fr' ? 'français' : 'anglais'}.`;
  return null;
}

/** « Dar Hmeti » + en → « DarHmeti_EN.srt » (sans accents ni espaces). */
export function srtFileName(title: string, lang: SrtLang): string {
  const base =
    title
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .split(/[^A-Za-z0-9]+/)
      .filter(Boolean)
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join('') || 'SousTitres';
  return `${base}_${lang.toUpperCase()}.srt`;
}

/** Fichier .srt prêt à télécharger (UTF-8). Lève une erreur si l'export est verrouillé. */
export function srtBlob(lines: SubtitleLine[], lang: SrtLang): Blob {
  const blocker = exportBlocker(lines, lang);
  if (blocker) throw new Error(blocker);
  return new Blob([new TextEncoder().encode(toSrt(lines, lang))], {
    type: 'application/x-subrip;charset=utf-8',
  });
}

/** Déclenche le téléchargement dans le navigateur (rien n'est envoyé au serveur). */
export function downloadSrt(lines: SubtitleLine[], lang: SrtLang, title: string): void {
  downloadBlob(srtBlob(lines, lang), srtFileName(title, lang));
}
