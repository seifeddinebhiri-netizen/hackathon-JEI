import { brand } from '@/app/brand';
import { Link } from 'react-router';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { Logo } from './Logo';

export function Footer() {
  const { user } = useAuth();
  return (
    <footer data-app-footer className="bg-ink text-paper">
      <div className="container-pp flex flex-col gap-8 py-12 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-3 text-meta text-muted-on-dark">{brand.tagline}</p>
        </div>
        <nav aria-label="Pied de page" className="grid grid-cols-2 gap-x-10 gap-y-1 text-meta">
          <Link className="min-h-11 py-3 hover:underline" to={user ? '/projet' : '/connexion'}>
            {user ? 'Mon projet' : 'Se connecter'}
          </Link>
          <Link className="min-h-11 py-3 hover:underline" to="/verifier/exemple">
            Exemple de vérification
          </Link>
          <a className="min-h-11 py-3 hover:underline" href="/#ethique">
            Éthique
          </a>
          <Link className="min-h-11 py-3 hover:underline" to="/mes-donnees">
            Mes données
          </Link>
          <Link className="min-h-11 py-3 hover:underline" to="/credits">
            Crédits photo
          </Link>
        </nav>
      </div>
      <div className="border-t border-line-dark">
        <p className="container-pp py-5 text-meta text-muted-on-dark">
          Projet du hackathon IA Éthique 360 · [avec le soutien de l’OIF : à confirmer]
        </p>
      </div>
    </footer>
  );
}
