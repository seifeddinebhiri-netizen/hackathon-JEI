import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { Button, ButtonLink, Field, Input, Skeleton } from '@/components/ui';
import { authErrorFromUrl } from '@/features/auth/authErrors';
import { AuthError, AuthNotice, AuthPage } from '@/features/auth/components/AuthPage';
import { useAuth } from '@/features/auth/hooks/useAuth';

const schema = z
  .object({
    password: z.string().min(6, 'Au moins 6 caractères.'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'Les deux mots de passe sont différents.',
  });
type Values = z.infer<typeof schema>;

/**
 * Arrivée depuis le lien reçu par email : Supabase lit le jeton dans l'adresse et ouvre une
 * session de récupération (le compte est alors connecté). On choisit ici le nouveau mot de passe.
 */
export default function ResetPassword() {
  const { user, initializing, updatePassword, loading } = useAuth();
  // Lu une seule fois : Supabase nettoie l'adresse après l'avoir traitée.
  const [linkError] = useState(() => authErrorFromUrl(window.location.href));
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: '', confirm: '' } });

  const submit = handleSubmit(async ({ password }) => {
    setServerError(undefined);
    try {
      await updatePassword(password);
      setDone(true);
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Enregistrement impossible. Réessaie.');
    }
  });

  const newLink = (
    <ButtonLink to="/mot-de-passe-oublie" variant="secondary" iconRight="arrowRight" className="self-start">
      Recevoir un nouveau lien
    </ButtonLink>
  );

  let body;
  if (initializing) {
    body = <Skeleton className="h-40" />;
  } else if (done) {
    body = (
      <>
        <AuthNotice>Mot de passe enregistré. Tu es connecté.</AuthNotice>
        <ButtonLink to="/projet" iconRight="arrowRight" className="self-start">
          Ouvrir mon projet
        </ButtonLink>
      </>
    );
  } else if (linkError || !user) {
    body = (
      <>
        <AuthError>
          {linkError ?? 'Ce lien n’est plus valable ou a déjà servi. Demande-en un nouveau.'}
        </AuthError>
        {newLink}
      </>
    );
  } else {
    body = (
      <form
        onSubmit={(e) => void submit(e)}
        noValidate
        className="flex flex-col gap-5"
        aria-labelledby="nouveau-titre"
      >
        <h2 id="nouveau-titre" className="text-h3">
          Nouveau mot de passe pour {user.email}
        </h2>
        {serverError ? <AuthError>{serverError}</AuthError> : null}
        <Field label="Nouveau mot de passe" error={errors.password?.message} required>
          <Input type="password" autoComplete="new-password" {...register('password')} />
        </Field>
        <Field label="Confirme le mot de passe" error={errors.confirm?.message} required>
          <Input type="password" autoComplete="new-password" {...register('confirm')} />
        </Field>
        <Button
          type="submit"
          variant="secondary"
          loading={isSubmitting}
          disabled={loading}
          className="self-start"
        >
          Enregistrer
        </Button>
      </form>
    );
  }

  return (
    <AuthPage
      eyebrow="Nouveau mot de passe"
      title={
        <>
          Une nouvelle <span className="text-brand-red">prise.</span>
        </>
      }
      lead="Choisis un mot de passe que tu n’utilises nulle part ailleurs."
      pose="salut"
      bulle="Allez, on la refait proprement."
    >
      <div className="flex flex-col gap-6">
        {body}
        {!done ? (
          <p className="text-meta">
            <Link
              to="/connexion"
              className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
            >
              Retour à la connexion
            </Link>
          </p>
        ) : null}
      </div>
    </AuthPage>
  );
}
