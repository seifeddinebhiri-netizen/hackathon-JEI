import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { Passport } from '@/api/types';
import { Button, ErrorState, Icon, StatusChip, useToast } from '@/components/ui';
import { env } from '@/lib/env';
import { formatDate } from '@/lib/format';
import { copyToClipboard, downloadBlob } from '@/lib/print';
import { usePassportCheck, usePassportPdf } from '../hooks/usePassport';
import { badgeSvg, svgToBlob, svgToPngBlob } from '../lib/badge';

function verifyUrl(p: Passport): string {
  return p.verify_url ?? `${env.publicAppUrl.replace(/\/$/, '')}/verifier/${p.id}`;
}

export function VerifyLink({ passport }: { passport: Passport }) {
  const { toast } = useToast();
  const url = verifyUrl(passport);
  return (
    <div className="flex flex-col gap-3 border-2 border-ink bg-ink p-4 text-paper">
      <p className="eyebrow flex items-center gap-1.5 text-gold">
        <Icon name="shield" size={14} /> Lien de vérification public
      </p>
      <p className="font-mono text-label break-all">{url}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="on-dark"
          size="sm"
          icon="copy"
          onClick={() =>
            void copyToClipboard(url).then((ok) =>
              toast(
                ok
                  ? { tone: 'ok', title: 'Lien de vérification copié' }
                  : { tone: 'bad', title: 'Copie impossible' },
              ),
            )
          }
        >
          Copier le lien
        </Button>
        <Link
          to={`/verifier/${passport.id}`}
          target="_blank"
          className="inline-flex min-h-11 items-center gap-1.5 px-3 text-meta font-semibold underline underline-offset-4"
        >
          <Icon name="external" size={16} /> Voir la page publique
        </Link>
      </div>
      <p className="flex flex-wrap items-center gap-2 text-meta text-muted-on-dark">
        {passport.c2pa_signed ? (
          <StatusChip tone="ok">Fichier final signé (C2PA)</StatusChip>
        ) : (
          <StatusChip tone="warn" icon="clock">
            Fichier final pas encore signé
          </StatusChip>
        )}
        Mis à jour le {formatDate(passport.updated_at)}
      </p>
    </div>
  );
}

export function BadgeExport({ passport }: { passport: Passport }) {
  const [light, setLight] = useState(false);
  const { toast } = useToast();
  const host = useMemo(() => {
    try {
      const u = new URL(verifyUrl(passport));
      return `${u.host}${u.pathname}`;
    } catch {
      return verifyUrl(passport);
    }
  }, [passport]);
  const svg = badgeSvg({ code: passport.badge_code ?? '—', verifyHost: host, light });
  const name = `passeport-ia-${passport.badge_code ?? passport.id}${light ? '-clair' : ''}`;

  return (
    <div className="flex flex-col gap-3">
      <p className="eyebrow">Badge pour le générique et l’affiche</p>
      <div className="border-2 border-line-light bg-paper p-3">
        <img
          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
          alt={`Badge Passeport IA ${passport.badge_code ?? ''}`}
          className="h-auto w-full"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => setLight((v) => !v)} aria-pressed={light}>
          Version {light ? 'sombre' : 'claire'}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon="download"
          onClick={() => downloadBlob(svgToBlob(svg), `${name}.svg`)}
        >
          SVG
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon="download"
          onClick={() =>
            void svgToPngBlob(svg)
              .then((b) => downloadBlob(b, `${name}.png`))
              .catch((e: Error) =>
                toast({ tone: 'bad', title: 'Export PNG impossible', description: e.message }),
              )
          }
        >
          PNG
        </Button>
      </div>
    </div>
  );
}

/** Une adresse `blob:` n'est plus utile une fois le PDF ouvert : on la libère après un moment. */
const RELEASE_BLOB_AFTER_MS = 5 * 60_000;

export function PdfAndSign({ passport }: { passport: Passport }) {
  const check = usePassportCheck(passport.id);
  const pdf = usePassportPdf(passport.project_id);
  const { toast } = useToast();

  const openPdf = () =>
    pdf.mutate(passport.id, {
      onSuccess: (r) => {
        window.open(r.url, '_blank', 'noopener');
        if (r.url.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(r.url), RELEASE_BLOB_AFTER_MS);
        if (r.signed) {
          toast({
            tone: 'ok',
            title: r.simulated ? 'PDF signé (signature de test)' : 'PDF signé (C2PA)',
            description: r.simulated
              ? 'Le certificat est un certificat de test : un lecteur public dira « signataire inconnu » tout en confirmant que le fichier n’a pas été modifié.'
              : 'Toute modification du fichier invalidera la signature.',
          });
        }
      },
      onError: (e) => toast({ tone: 'bad', title: 'PDF indisponible', description: e.message }),
    });

  return (
    <div className="flex flex-col gap-4">
      {check.isError ? (
        <ErrorState title="Contrôle impossible" error={check.error} onRetry={() => void check.refetch()} />
      ) : null}
      {check.data && !check.data.ok ? (
        <div className="border-2 border-warn-fg/40 bg-warn-bg p-3 text-warn-fg">
          <p className="flex items-center gap-1.5 font-semibold">
            <Icon name="alert" size={16} /> Avant le PDF, il manque :
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-meta">
            {check.data.missing.map((m, i) => (
              <li key={i}>{m.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {check.data?.warnings.length ? (
        <ul className="flex flex-col gap-1.5 text-meta text-muted-on-light">
          {check.data.warnings.map((w) => (
            <li key={w} className="flex items-start gap-1.5">
              <Icon name="info" size={14} className="mt-0.5 shrink-0" /> {w}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button icon="doc" onClick={openPdf} loading={pdf.isPending} disabled={!check.data?.ok}>
          {passport.c2pa_signed ? 'Générer à nouveau le PDF signé' : 'Générer le PDF signé'}
        </Button>
      </div>
      <p className="flex items-start gap-1.5 text-meta text-muted-on-light">
        <Icon name="shield" size={14} className="mt-0.5 shrink-0" />
        Le PDF est fabriqué et signé (C2PA) par notre serveur à partir de ton Passeport enregistré. La
        signature prouve que le fichier n’a pas été modifié depuis son émission, pas que les déclarations sont
        exactes. Si tu modifies le Passeport ensuite, il faut régénérer le PDF.
      </p>
    </div>
  );
}
