import { ButtonLink } from '@/components/ui';
import { BabaJamil } from '@/components/BabaJamil';
import { useAuth } from '@/features/auth/hooks/useAuth';

/** Appel final sur aplat rouge (texte blanc sur #E4202E : contraste 4,6:1, titres en grand corps). */
export function FinalCta() {
  const { user } = useAuth();
  return (
    <section aria-labelledby="cta-titre" className="bg-brand-red text-white">
      <div className="container-pp flex flex-col gap-8 py-16 md:flex-row md:items-end md:justify-between md:py-24">
        <div>
          <h2 id="cta-titre" className="max-w-3xl text-[44px] leading-[0.95] md:text-[72px]">
            Ton film, bien encadré.
          </h2>
          <p className="mt-4 max-w-xl text-lead font-medium">
            Ouvre le projet de démonstration ou crée le tien : planning, Passeport IA et Kit Festival.
          </p>
        </div>
        <div className="flex flex-col items-start gap-4 md:flex-row md:items-center">
          <BabaJamil pose="montre" taille="m" cote="gauche" bulle="C’est par ici !" className="shrink-0" />
          <ButtonLink
            to={user ? '/projet' : '/connexion'}
            variant="secondary"
            size="lg"
            iconRight="arrowRight"
            className="shrink-0"
          >
            {user ? 'Ouvrir mon projet' : 'Commencer mon projet'}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
