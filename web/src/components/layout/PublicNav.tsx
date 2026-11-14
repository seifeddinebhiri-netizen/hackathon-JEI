import { useAuth } from '@/features/auth/hooks/useAuth';
import { ButtonLink } from '@/components/ui';
import { Logo } from './Logo';

export function PublicNav() {
  const { user } = useAuth();
  return (
    <header data-app-header className="bg-ink text-paper">
      <div className="container-pp flex min-h-16 items-center justify-between gap-4">
        <Logo />
        <nav aria-label="Navigation principale" className="flex items-center gap-1 md:gap-4">
          <a href="/#etapes" className="hidden min-h-11 items-center px-2 text-meta hover:underline md:inline-flex">
            Comment ça marche
          </a>
          <a href="/#ethique" className="hidden min-h-11 items-center px-2 text-meta hover:underline md:inline-flex">
            Éthique
          </a>
          {user ? (
            <ButtonLink to="/projet" variant="on-dark" size="sm">
              Mon projet
            </ButtonLink>
          ) : (
            <ButtonLink to="/connexion" variant="on-dark" size="sm">
              Se connecter
            </ButtonLink>
          )}
        </nav>
      </div>
    </header>
  );
}
