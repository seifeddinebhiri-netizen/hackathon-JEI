import { ButtonLink } from '@/components/ui';

export default function NotFound() {
  return (
    <div className="container-pp py-20">
      <p className="eyebrow text-muted-on-light">Erreur 404</p>
      <h1 className="mt-3 text-page">Cette page n’existe pas.</h1>
      <ButtonLink to="/" className="mt-8">
        Retour à l’accueil
      </ButtonLink>
    </div>
  );
}
