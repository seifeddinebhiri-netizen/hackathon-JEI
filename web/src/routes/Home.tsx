import { ButtonLink } from '@/components/ui';

export default function Home() {
  return (
    <section className="bg-ink text-paper">
      <div className="container-pp py-20">
        <h1 className="text-[56px] leading-[0.92] md:text-hero">
          Tourne. Déclare. Fais-toi <span className="text-brand-red">voir.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lead text-muted-on-dark">Accueil complet en phase 2.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink to="/connexion" size="lg">
            Commencer
          </ButtonLink>
          {import.meta.env.DEV ? (
            <ButtonLink to="/_ui" variant="on-dark" size="lg">
              Kit UI (dev)
            </ButtonLink>
          ) : null}
        </div>
      </div>
    </section>
  );
}
