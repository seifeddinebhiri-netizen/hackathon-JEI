import { Link, useParams } from 'react-router';
import { isApiError } from '@/api';
import { brand } from '@/app/brand';
import { LogoImage } from '@/components/layout/Logo';
import { ButtonLink, EmptyState, ErrorState, Icon, LoadingBlock, PhotoFrame } from '@/components/ui';
import { usePublicFilm } from '@/features/festival/hooks/useFestivals';
import { photoFromUrl } from '@/lib/photos';

const CREW_ROLES =
  /réalisation|image|son|régie|montage|scripte|production|musique|maquillage|costumes|assistanat/i;
/** Un rôle de distribution est un nom de personnage (pas un poste technique). */
const isCast = (role: string) => !CREW_ROLES.test(role);

export default function FilmPublic() {
  const { id } = useParams();
  const q = usePublicFilm(id);

  if (q.isPending)
    return (
      <div className="container-pp py-12">
        <LoadingBlock lines={8} label="Chargement de la page film…" />
      </div>
    );
  if (q.isError)
    return (
      <div className="container-pp py-12">
        {isApiError(q.error) && q.error.code === 'introuvable' ? (
          <EmptyState
            icon="film"
            title="Film introuvable"
            action={
              <ButtonLink to="/" variant="secondary">
                Retour à l’accueil
              </ButtonLink>
            }
          >
            Aucun film ne correspond à ce lien.
          </EmptyState>
        ) : (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        )}
      </div>
    );

  const f = q.data;
  const [hero, ...rest] = f.stills;
  const heroPhoto = hero ? photoFromUrl(hero) : undefined;
  return (
    <article>
      <header className="bg-ink text-paper">
        <div className="container-pp grid grid-cols-1 gap-10 py-12 md:py-16 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-6">
            <p className="eyebrow text-gold">Dossier de presse</p>
            <h1 className="mt-4 text-[52px] leading-[0.92] md:text-[88px]">{f.title}</h1>
            <p className="mt-4 text-lead text-muted-on-dark">Un film de {f.director}</p>
            {f.synopsis_short ? <p className="mt-6 max-w-xl text-lead">{f.synopsis_short}</p> : null}
            <div className="mt-8 flex flex-wrap gap-3">
              {f.trailer_url ? (
                <a
                  href={f.trailer_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-14 items-center gap-2 border-2 border-action bg-action px-6 font-semibold text-white hover:bg-action-hover"
                >
                  <Icon name="film" size={18} /> Voir la bande-annonce
                  <span className="sr-only"> (nouvel onglet)</span>
                </a>
              ) : null}
              {f.verify_url && f.passport_badge_code ? (
                <Link
                  to={`/verifier/${f.verify_url.split('/').pop()}`}
                  className="inline-flex min-h-14 items-center gap-2 border-2 border-paper px-6 font-semibold hover:bg-paper hover:text-ink"
                >
                  <Icon name="shield" size={18} /> Passeport IA {f.passport_badge_code}
                </Link>
              ) : null}
            </div>
          </div>
          <div className="lg:col-span-6">
            {hero ? (
              <PhotoFrame
                photo={heroPhoto}
                src={heroPhoto ? undefined : hero}
                alt={heroPhoto?.alt ?? `Photo du film ${f.title}`}
                ratio="2.39:1"
                onDark
                priority
              />
            ) : null}
          </div>
        </div>
      </header>

      <div className="container-pp grid grid-cols-1 gap-12 py-12 md:py-16 lg:grid-cols-12">
        <section aria-labelledby="synopsis" className="lg:col-span-7">
          <h2 id="synopsis" className="text-h2">
            Synopsis
          </h2>
          <p className="mt-4 max-w-prose text-lead whitespace-pre-line">
            {f.synopsis_long || f.synopsis_short || 'Synopsis à venir.'}
          </p>

          {rest.length ? (
            <>
              <h2 className="mt-12 text-h2">Photos</h2>
              <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {rest.map((s) => {
                  const ph = photoFromUrl(s);
                  return (
                    <li key={s}>
                      <PhotoFrame
                        photo={ph}
                        src={ph ? undefined : s}
                        alt={ph?.alt ?? `Photo du film ${f.title}`}
                        ratio="16:10"
                        sizes="(min-width: 640px) 30vw, 100vw"
                      />
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
        </section>

        <aside className="flex flex-col gap-8 lg:col-span-5">
          <section aria-labelledby="generique" className="border-2 border-ink bg-white p-5">
            <h2 id="generique" className="eyebrow mb-3">
              Générique
            </h2>
            {f.credits.length ? (
              [
                { title: 'Distribution', list: f.credits.filter((c) => isCast(c.role)) },
                { title: 'Équipe', list: f.credits.filter((c) => !isCast(c.role)) },
              ]
                .filter((g) => g.list.length)
                .map((g) => (
                  <div key={g.title} className="mt-3 first:mt-0">
                    <h3 className="eyebrow mb-2 text-muted-on-light">{g.title}</h3>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
                      {g.list.map((c, i) => (
                        <div key={i} className="contents">
                          <dt className="text-muted-on-light">{c.role}</dt>
                          <dd className="font-semibold">{c.name}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))
            ) : (
              <p className="text-muted-on-light">Générique à venir.</p>
            )}
          </section>

          {f.passport_badge_code && f.verify_url ? (
            <section
              aria-labelledby="ia"
              className="border-2 border-ink bg-ink p-5 text-paper shadow-hard-gold"
            >
              <h2 id="ia" className="eyebrow flex items-center gap-1.5 text-gold">
                <Icon name="shield" size={14} /> Passeport IA
              </h2>
              <p className="mt-3 font-mono text-[22px]">{f.passport_badge_code}</p>
              <p className="mt-2 text-meta text-muted-on-dark">
                L’équipe déclare, département par département, ce qui est humain et ce qui est IA.
              </p>
              <Link
                to={`/verifier/${f.verify_url.split('/').pop()}`}
                className="mt-4 inline-flex min-h-11 items-center gap-1.5 font-semibold underline underline-offset-4"
              >
                Vérifier la déclaration <Icon name="arrowRight" size={16} />
              </Link>
            </section>
          ) : null}
          <p className="flex items-center gap-3 text-meta text-muted-on-light">
            <LogoImage onDark={false} height={28} />
            Page publiée avec {brand.name}.
          </p>
        </aside>
      </div>
    </article>
  );
}
