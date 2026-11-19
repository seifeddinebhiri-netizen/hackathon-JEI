import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { Button, Field, Input } from '@/components/ui';
import { AuthError, AuthNotice, AuthPage } from '@/features/auth/components/AuthPage';
import { useAuth } from '@/features/auth/hooks/useAuth';

const schema = z.object({
  email: z.string().trim().min(1, 'Indique ton email.').email('Cet email n’a pas l’air valide.'),
});
type Values = z.infer<typeof schema>;

export default function ForgotPassword() {
  const { requestPasswordReset, authMode } = useAuth();
  const [sentTo, setSentTo] = useState<string>();
  const [serverError, setServerError] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '' } });

  const submit = handleSubmit(async ({ email }) => {
    setServerError(undefined);
    try {
      await requestPasswordReset(email);
      setSentTo(email);
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Envoi du lien impossible. Réessaie.');
    }
  });

  return (
    <AuthPage
      eyebrow="Mot de passe oublié"
      title={
        <>
          On te renvoie <span className="text-brand-red">la clé.</span>
        </>
      }
      lead="Indique l’email de ton compte : tu recevras un lien pour choisir un nouveau mot de passe."
      pose="parle"
      bulle="Ça arrive à tout le monde, même aux meilleurs chefs op."
    >
      <div className="flex flex-col gap-6">
        {authMode !== 'supabase' ? (
          <AuthError>La réinitialisation du mot de passe demande la connexion réelle (Supabase).</AuthError>
        ) : sentTo ? (
          <AuthNotice>
            Si un compte existe pour {sentTo}, un email vient de partir avec un lien valable une heure. Pense
            à regarder dans les indésirables.
          </AuthNotice>
        ) : (
          <form
            onSubmit={(e) => void submit(e)}
            noValidate
            className="flex flex-col gap-5"
            aria-labelledby="oubli-titre"
          >
            <h2 id="oubli-titre" className="text-h3">
              Recevoir un lien
            </h2>
            {serverError ? <AuthError>{serverError}</AuthError> : null}
            <Field label="Email" error={errors.email?.message} required>
              <Input type="email" autoComplete="email" inputMode="email" {...register('email')} />
            </Field>
            <Button type="submit" variant="secondary" loading={isSubmitting} className="self-start">
              Envoyer le lien
            </Button>
          </form>
        )}
        <p className="text-meta">
          <Link
            to="/connexion"
            className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
          >
            Retour à la connexion
          </Link>
        </p>
      </div>
    </AuthPage>
  );
}
