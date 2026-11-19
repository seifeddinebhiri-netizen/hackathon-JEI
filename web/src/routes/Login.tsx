import { useNavigate, useSearchParams } from 'react-router';
import { ButtonLink } from '@/components/ui';
import { AuthPage } from '@/features/auth/components/AuthPage';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { NEXT_PARAM, safeNext } from '@/features/auth/redirect';

export default function Login() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Page demandée avant la connexion (?suite=) : chemin interne uniquement, sinon /projet.
  const next = safeNext(useSearchParams()[0].get(NEXT_PARAM));

  return (
    <AuthPage
      eyebrow="Connexion"
      title={
        <>
          Retour sur le <span className="text-brand-red">plateau.</span>
        </>
      }
      lead="Ton planning, ton Passeport IA et ta sélection de festivals t’attendent là où tu les as laissés."
      pose="salut"
      bulle="Ahla wlidi ! On reprend le tournage ?"
    >
      {user ? (
        <div className="flex flex-col items-start gap-4">
          <h2 className="text-h2">Tu es connecté en tant que {user.name}.</h2>
          <ButtonLink to={next} iconRight="arrowRight">
            {next === '/projet' ? 'Ouvrir mon projet' : 'Continuer'}
          </ButtonLink>
        </div>
      ) : (
        <LoginForm onSuccess={() => navigate(next, { replace: true })} />
      )}
    </AuthPage>
  );
}
