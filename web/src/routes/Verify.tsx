import { useEffect } from 'react';
import { BabaJamil } from '@/components/BabaJamil';
import { useParams, useSearchParams } from 'react-router';
import { isApiError } from '@/api';
import { brand } from '@/app/brand';
import { LogoImage } from '@/components/layout/Logo';
import { Button, ButtonLink, EmptyState, ErrorState, Icon, LoadingBlock, StatusChip } from '@/components/ui';
import { AiLabel } from '@/features/passport/components/AiLabel';
import { DeclarationDetail } from '@/features/passport/components/DeclarationDetail';
import { VerifyPdf } from '@/features/passport/components/VerifyPdf';
import { useVerifyPassport } from '@/features/passport/hooks/usePassport';
import { DEPARTMENTS, LABEL_DISCLAIMER, summarize, TOOL_STATUS_HELP } from '@/features/passport/lib/labels';
import { formatDate } from '@/lib/format';
import { printPage } from '@/lib/print';

export default function Verify() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const q = useVerifyPassport(id);
  const printMode = params.get('imprimer') === '1';

  useEffect(() => {
    if (printMode && q.data) {
      const t = setTimeout(printPage, 400);
      return () => clearTimeout(t);
    }
  }, [printMode, q.data]);

  if (q.isPending)
    return (
      <div className="container-pp py-12">
        <LoadingBlock lines={8} label="Vérification en cours…" />
      </div>
    );
  if (q.isError) {
    const notFound = isApiError(q.error) && q.error.code === 'introuvable';
    return (
      <div className="container-pp py-12">
        {notFound ? (
          <EmptyState
            icon="shield"
            title="Passeport introuvable"
            action={
              <ButtonLink to="/verifier/exemple" variant="secondary">
                Voir un exemple
              </ButtonLink>
            }
          >
            Aucun Passeport IA ne correspond à l’identifiant « {id} ». Vérifie le lien ou le code imprimé sur
            le badge.
          </EmptyState>
        ) : (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        )}
      </div>
    );
  }

  const { passport: p, tools, signature, checked_at } = q.data;
  const counts = summarize(p.declarations);
  return (
    <div className="bg-paper">
      <section className="bg-ink text-paper print:bg-white print:text-ink">
        <div className="container-pp flex flex-col gap-6 py-10 md:flex-row md:items-end md:justify-between md:py-14">
          <div>
            <p className="eyebrow flex items-center gap-2 text-gold print:text-ink">
              <Icon name="shield" size={16} /> Vérification · Passeport IA
            </p>
            <h1 className="mt-4 text-[44px] leading-none md:text-page">{p.film_title}</h1>
            <p className="mt-3 text-lead text-muted-on-dark print:text-ink">Réalisation : {p.director}</p>
            <ul className="mt-6 flex flex-wrap gap-2" aria-label="Résumé de la déclaration">
              <li>
                <StatusChip tone="neutral" icon="user">
                  {counts.humain} département{counts.humain > 1 ? 's' : ''} 100 % humain
                  {counts.humain > 1 ? 's' : ''}
                </StatusChip>
              </li>
              <li>
                <StatusChip tone="gold" icon="users">
                  {counts.assiste} assisté{counts.assiste > 1 ? 's' : ''} par IA
                </StatusChip>
              </li>
              <li>
                <StatusChip tone="gold" icon="sparkle">
                  {counts.genere} généré{counts.genere > 1 ? 's' : ''} par IA
                </StatusChip>
              </li>
            </ul>
            {counts.non_renseigne ? (
              <p className="mt-3 flex items-center gap-2 text-meta font-semibold text-gold print:text-ink">
                <Icon name="alert" size={16} /> Déclaration incomplète : {counts.non_renseigne} département
                {counts.non_renseigne > 1 ? 's' : ''} sur {DEPARTMENTS.length} non renseigné
                {counts.non_renseigne > 1 ? 's' : ''}.
              </p>
            ) : null}
          </div>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-meta">
            <div>
              <dt className="eyebrow text-muted-on-dark print:text-ink">Identifiant</dt>
              <dd className="font-mono text-lead">{p.badge_code ?? p.id}</dd>
            </div>
            <div>
              <dt className="eyebrow text-muted-on-dark print:text-ink">Déclaration du</dt>
              <dd>{formatDate(p.updated_at)}</dd>
            </div>
            <div className="col-span-2">
              <dt className="eyebrow text-muted-on-dark print:text-ink">Signature du PDF</dt>
              <dd className="mt-1">
                {signature.signed ? (
                  <StatusChip tone="ok">
                    Signé (C2PA){signature.signed_at ? ` le ${formatDate(signature.signed_at)}` : ''}
                  </StatusChip>
                ) : (
                  <StatusChip tone="warn" icon="clock">
                    Pas encore signé
                  </StatusChip>
                )}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <div className="container-pp grid grid-cols-1 gap-10 py-10 md:py-14 lg:grid-cols-12">
        <aside className="lg:col-span-4">
          <div className="flex flex-col gap-4 lg:sticky lg:top-6">
            <AiLabel
              filmTitle={p.film_title}
              director={p.director}
              badgeCode={p.badge_code}
              declarations={p.declarations}
              tools={tools}
              className="shadow-hard print:shadow-none"
            />
            <Button variant="secondary" icon="printer" onClick={printPage} className="no-print">
              Imprimer / PDF
            </Button>
            <BabaJamil
              pose="declarer"
              taille="s"
              bulle="Ici, on dit tout : ce qui est humain et ce qui vient de l’IA."
              className="no-print mt-2"
            />
          </div>
        </aside>
        <section aria-labelledby="detail-titre" className="lg:col-span-8">
          <h2 id="detail-titre" className="text-h2">
            Détail par département
          </h2>
          <p className="mt-2 mb-6 max-w-prose text-muted-on-light">
            Déclaré par l’équipe du film. Pour chaque outil : le statut de documentation publié par son
            fournisseur, la source et la date de vérification.
          </p>
          <DeclarationDetail declarations={p.declarations} tools={tools} />
          <VerifyPdf badgeCode={p.badge_code} />
          <div className="mt-8 flex flex-col gap-3 border-2 border-ink bg-white p-5">
            <p className="flex items-start gap-2 font-semibold">
              <Icon name="info" size={18} className="mt-0.5 shrink-0" /> {LABEL_DISCLAIMER}
            </p>
            <p className="text-meta text-muted-on-light">{TOOL_STATUS_HELP}</p>
            <p className="flex flex-wrap items-center gap-3 text-meta text-muted-on-light">
              <LogoImage onDark={false} height={28} />
              Page générée par {brand.name} · vérifiée le {formatDate(checked_at)}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
