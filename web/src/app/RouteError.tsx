import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

/** Filet de sécurité : jamais d'écran blanc, même si un écran plante. */
export function RouteError() {
  const err = useRouteError();
  const message = isRouteErrorResponse(err)
    ? `${err.status} ${err.statusText}`
    : err instanceof Error
      ? err.message
      : 'Erreur inconnue';
  const chunkFailed =
    err instanceof Error && /dynamically imported module|Failed to fetch/i.test(err.message);
  return (
    <main className="container-pp py-16">
      <p className="eyebrow text-muted-on-light">Erreur</p>
      <h1 className="mt-3 text-[40px] leading-none md:text-page">Cette page n’a pas pu s’afficher.</h1>
      <p className="mt-4 max-w-prose text-lead text-muted-on-light">
        {chunkFailed ? 'Une nouvelle version est peut-être disponible : recharge la page.' : message}
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-11 border-2 border-action bg-action px-5 font-semibold text-white hover:bg-action-hover"
        >
          Recharger
        </button>
        <Link to="/" className="inline-flex min-h-11 items-center border-2 border-ink px-5 font-semibold">
          Retour à l’accueil
        </Link>
      </div>
    </main>
  );
}
