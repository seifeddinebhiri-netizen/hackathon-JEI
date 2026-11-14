import { ButtonLink, Perforations } from '@/components/ui';
import { useAuth } from '@/features/auth/hooks/useAuth';

export default function NotFound() {
  const { user } = useAuth();
  return (
    <section aria-labelledby="titre-404" className="bg-ink text-paper">
      <Perforations />
      <div className="container-pp grid grid-cols-1 gap-10 py-16 md:py-24 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-7">
          <p className="eyebrow text-gold">Erreur 404 · Scène manquante</p>
          <h1 id="titre-404" className="mt-4 text-[52px] leading-[0.92] md:text-[88px]">
            Ce plan a été coupé <span className="text-brand-red">au montage.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lead text-muted-on-dark">
            La page que tu cherches n’existe pas ou a changé d’adresse. Vérifie le lien, ou reprends depuis le
            début.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <ButtonLink to={user ? '/projet' : '/'} size="lg" icon="arrowLeft">
              {user ? 'Retour à mon projet' : 'Retour à l’accueil'}
            </ButtonLink>
            <ButtonLink to="/verifier/exemple" variant="on-dark" size="lg">
              Vérifier un Passeport IA
            </ButtonLink>
          </div>
        </div>
        <div aria-hidden className="lg:col-span-5">
          <div className="border-2 border-paper p-6 md:rotate-[2deg]">
            <div className="grid grid-cols-3 border-b-2 border-paper pb-3 font-mono text-label text-muted-on-dark">
              <span>Scène</span>
              <span>Plan</span>
              <span>Prise</span>
            </div>
            <div className="grid grid-cols-3 pt-3 font-display text-[64px] leading-none font-bold md:text-[88px]">
              <span>4</span>
              <span className="text-gold">0</span>
              <span className="text-brand-red">4</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
