/** Ouvre la boîte d'impression du navigateur (styles @media print dans styles/index.css). */
export function printPage(): void {
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
