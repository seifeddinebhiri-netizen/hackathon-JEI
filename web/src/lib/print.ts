/** Ouvre la boîte d'impression du navigateur (styles @media print dans styles/index.css). */
export function printPage(): void {
  window.print();
}

/** « Le dernier ferry » → « Le-dernier-ferry » (nom de fichier sûr partout). */
export function fileSlug(text: string): string {
  return (
    text
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'document'
  );
}

/** Texte sûr dans une chaîne CSS (content: "…"). */
const cssString = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ')}"`;

/**
 * Téléchargement en PDF par la boîte d'impression du navigateur (« Enregistrer en PDF ») :
 * texte sélectionnable, polices et couleurs de l'app. Le nom proposé vient du titre de la page.
 * Pied de page sur chaque feuille : le film et la date à gauche, le numéro de page à droite.
 */
export function printAsPdf(filename: string, footer: string): void {
  const previousTitle = document.title;
  document.title = filename;
  const style = document.createElement('style');
  style.textContent = `@page { @bottom-left { content: ${cssString(footer)}; } }`;
  document.head.appendChild(style);
  const restore = () => {
    document.title = previousTitle;
    style.remove();
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  window.print();
}

/** Copie un texte dans le presse-papiers ; renvoie false si le navigateur refuse. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Déclenche le téléchargement d'un Blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
