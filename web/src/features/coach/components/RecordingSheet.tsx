import { useMemo, useState } from 'react';
import { Button } from '@/components/ui';
import { describeMime, formatDuration, type RecorderState } from '../useRecorder';

type Done = Extract<RecorderState, { status: 'done' }>;

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

/**
 * Vidéo prête : l'utilisateur l'enregistre sur son téléphone ou la supprime. Rien n'est envoyé.
 * « Enregistrer la vidéo » télécharge un fichier (sur iPhone : dans le dossier choisi dans
 * Réglages > Safari > Téléchargements, iCloud Drive par défaut). « Ajouter à Photos / Partager »
 * ouvre le menu de partage du téléphone, où l'utilisateur choisit la destination (Photos, etc.).
 */
export function RecordingSheet({ done, onDiscard }: { done: Done; onDiscard: () => void }) {
  // Une nouvelle prise remonte ce composant : le nom est donc calculé une fois par vidéo.
  const [filename] = useState(() => `plan-${stamp()}.${done.extension}`);
  // Le type sans « ;codecs=… » : c'est ce que le menu de partage attend.
  const file = useMemo(
    () => new File([done.blob], filename, { type: done.blob.type.split(';')[0] }),
    [done.blob, filename],
  );
  const canShare = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  const [shareError, setShareError] = useState(false);

  const share = async () => {
    setShareError(false);
    try {
      await navigator.share({ files: [file], title: 'Plan filmé' });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setShareError(true); // annulé : pas une erreur
    }
  };

  return (
    <section aria-label="Vidéo enregistrée" className="border-2 border-gold bg-ink/90 p-3 text-paper">
      <p className="font-display text-h3 font-bold">Vidéo prête · {formatDuration(done.seconds)}</p>
      <p className="mt-1 text-meta text-muted-on-dark">
        Elle n’existe que dans ce navigateur : enregistre-la avant de fermer. Rien n’est envoyé.
      </p>
      <p className="mt-1 font-mono text-label text-muted-on-dark">
        {done.info.width > 0 ? `${done.info.width}×${done.info.height} · ` : ''}
        {done.info.fps !== null ? `${done.info.fps} i/s reçues de la caméra · ` : ''}
        {describeMime(done.info.mime)}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {canShare ? (
          <Button size="sm" onClick={() => void share()}>
            Ajouter à Photos / Partager
          </Button>
        ) : null}
        <a
          href={done.url}
          download={filename}
          className="inline-flex min-h-11 items-center justify-center border-2 border-paper px-3 text-meta font-semibold text-paper"
        >
          Enregistrer la vidéo
        </a>
        <Button variant="on-dark" size="sm" onClick={onDiscard}>
          Supprimer
        </Button>
      </div>
      {canShare ? (
        <p className="mt-1 text-label text-muted-on-dark">
          Sur iPhone, « Enregistrer la vidéo » la range dans Fichiers (iCloud Drive par défaut). Pour la
          Photothèque, utilise « Ajouter à Photos », puis « Enregistrer la vidéo ».
        </p>
      ) : null}
      {shareError ? (
        <p role="alert" className="mt-1 text-label text-gold">
          Le partage n’a pas pu s’ouvrir. Utilise « Enregistrer la vidéo ».
        </p>
      ) : null}
    </section>
  );
}
