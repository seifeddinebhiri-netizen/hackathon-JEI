import { useLocation, useNavigate } from 'react-router';
import { ButtonLink, Perforations } from '@/components/ui';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { useAuth } from '@/features/auth/hooks/useAuth';

export default function Login() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/projet';

  return (
    <div className="grid lg:min-h-[calc(100dvh-64px)] lg:grid-cols-12">
      <aside className="flex flex-col justify-between bg-ink text-paper lg:col-span-5">
        <div className="container-pp py-12 lg:px-12 lg:py-16 xl:px-16">
          <p className="eyebrow text-gold">Connexion</p>
          <h1 className="mt-4 text-[44px] leading-[0.95] md:text-page">
            Retour sur le <span className="text-brand-red">plateau.</span>
          </h1>
          <p className="mt-6 max-w-md text-lead text-muted-on-dark">
            Ton planning, ton Passeport IA et ta sélection de festivals t’attendent là où tu les as laissés.
          </p>
        </div>
        <Perforations className="hidden lg:flex" />
      </aside>

      <div className="container-pp py-12 lg:col-span-7 lg:max-w-2xl lg:px-12 lg:py-16 xl:px-16">
        {user ? (
          <div className="flex flex-col items-start gap-4">
            <h2 className="text-h2">Tu es connecté en tant que {user.name}.</h2>
            <ButtonLink to={from} iconRight="arrowRight">
              Ouvrir mon projet
            </ButtonLink>
          </div>
        ) : (
          <LoginForm onSuccess={() => navigate(from, { replace: true })} />
        )}
      </div>
    </div>
  );
}
