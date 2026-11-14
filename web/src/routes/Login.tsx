import { useNavigate, useLocation } from 'react-router';
import { Button } from '@/components/ui';
import { useAuth } from '@/features/auth/hooks/useAuth';

/** Version minimale (phase 1) : formulaire complet en phase 2. */
export default function Login() {
  const { signInDemo, loading } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/projet';
  return (
    <div className="container-pp py-16">
      <h1 className="text-page">Connexion</h1>
      <Button className="mt-8" loading={loading} onClick={() => void signInDemo().then(() => navigate(from, { replace: true }))}>
        Continuer en démo
      </Button>
    </div>
  );
}
