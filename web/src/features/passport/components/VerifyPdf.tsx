import { useId, useState } from 'react';
import { Icon, StatusChip } from '@/components/ui';
import { useVerifyPdf } from '../hooks/usePassport';
import { VERDICT_LIMIT, verdictOf } from '../lib/pdfVerdict';

/** Même plafond que le serveur (8 Mo) : on évite d'envoyer un fichier qui sera refusé. */
export const MAX_PDF_MB = 8;

/**
 * « J'ai reçu un PDF » : le festival le dépose, le serveur vérifie sa signature et le compare au
 * Passeport affiché. Public (sans compte). Le fichier est lu puis oublié.
 */
export function VerifyPdf({ badgeCode }: { badgeCode?: string }) {
  const verify = useVerifyPdf();
  const id = useId();
  const [tooBig, setTooBig] = useState(false);

  const onPick = (file: File | undefined) => {
    setTooBig(false);
    if (!file) return;
    if (file.size > MAX_PDF_MB * 1024 * 1024) {
      setTooBig(true);
      verify.reset();
      return;
    }
    verify.mutate(file);
  };

  const verdict = verify.data ? verdictOf(verify.data, badgeCode) : null;

  return (
    <section
      aria-labelledby={`${id}-titre`}
      className="no-print mt-8 flex flex-col gap-4 border-2 border-ink bg-white p-5"
    >
      <div>
        <h2 id={`${id}-titre`} className="text-h3">
          J’ai reçu un PDF de ce Passeport
        </h2>
        <p className="mt-1 text-meta text-muted-on-light">
          Dépose-le ici pour vérifier qu’il n’a pas été modifié et qu’il a bien été émis par ce site. Le
          fichier est lu puis oublié : rien n’est conservé.
        </p>
      </div>

      <div>
        <label
          htmlFor={`${id}-fichier`}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 border-2 border-ink bg-gold px-4 text-meta font-semibold"
        >
          <Icon name="doc" size={16} /> Choisir le PDF
        </label>
        <input
          id={`${id}-fichier`}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          onChange={(e) => {
            onPick(e.target.files?.[0]);
            e.target.value = ''; // permet de redéposer le même fichier
          }}
        />
      </div>

      {verify.isPending ? (
        <p role="status" className="text-meta text-muted-on-light">
          Vérification en cours…
        </p>
      ) : null}
      {tooBig ? (
        <p role="alert" className="text-meta font-semibold text-warn-fg">
          Ce fichier dépasse {MAX_PDF_MB} Mo : ce n’est probablement pas un Passeport de ce site.
        </p>
      ) : null}
      {verify.isError ? (
        <p role="alert" className="flex items-start gap-1.5 text-meta font-semibold text-warn-fg">
          <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
          {verify.error.message}
        </p>
      ) : null}

      {verdict ? (
        <div role="status" aria-live="polite" className="flex flex-col gap-2 border-2 border-line-light p-4">
          <StatusChip tone={verdict.tone} icon={verdict.tone === 'ok' ? 'check' : 'alert'}>
            {verdict.title}
          </StatusChip>
          {verdict.details.map((d) => (
            <p key={d} className="text-meta">
              {d}
            </p>
          ))}
          <p className="text-label text-muted-on-light">{VERDICT_LIMIT}</p>
        </div>
      ) : null}
    </section>
  );
}
