import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { brand } from '@/app/brand';
import { Button, Field, Icon, Input } from '@/components/ui';
import { useAuth } from '../hooks/useAuth';
import { AuthError, AuthNotice } from './AuthPage';

const email = z.string().trim().min(1, 'Indique ton email.').email('Cet email n’a pas l’air valide.');
const password = z.string().min(6, 'Au moins 6 caractères.');
const signInSchema = z.object({ email, password });
const signUpSchema = z.object({
  name: z.string().trim().min(1, 'Indique ton prénom.').max(60),
  email,
  password,
});
type SignInValues = z.infer<typeof signInSchema>;
type SignUpValues = z.infer<typeof signUpSchema>;

function SignInForm({ onSuccess }: { onSuccess: () => void }) {
  const { signIn, loading, authMode } = useAuth();
  const [serverError, setServerError] = useState<string>();
  const [pending, setPending] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const submit = handleSubmit(async (v) => {
    setServerError(undefined);
    setPending(true);
    try {
      await signIn(v.email, v.password);
      onSuccess();
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Connexion impossible.');
    } finally {
      setPending(false);
    }
  });

  return (
    <form
      onSubmit={(e) => void submit(e)}
      noValidate
      className="flex flex-col gap-5"
      aria-labelledby="form-titre"
    >
      <h2 id="form-titre" className="text-h3">
        Se connecter avec un email
      </h2>
      {serverError ? <AuthError>{serverError}</AuthError> : null}
      <Field label="Email" error={errors.email?.message} required>
        <Input type="email" autoComplete="email" inputMode="email" {...register('email')} />
      </Field>
      <Field label="Mot de passe" error={errors.password?.message} required>
        <Input type="password" autoComplete="current-password" {...register('password')} />
      </Field>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Button type="submit" variant="secondary" loading={pending} disabled={loading}>
          Se connecter
        </Button>
        {authMode === 'supabase' ? (
          <Link
            to="/mot-de-passe-oublie"
            className="inline-flex min-h-11 items-center text-meta font-semibold underline underline-offset-4"
          >
            Mot de passe oublié ?
          </Link>
        ) : null}
      </div>
    </form>
  );
}

function SignUpForm({ onSuccess, onConfirmEmail }: { onSuccess: () => void; onConfirmEmail: () => void }) {
  const { signUp, loading } = useAuth();
  const [serverError, setServerError] = useState<string>();
  const [pending, setPending] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const submit = handleSubmit(async (v) => {
    setServerError(undefined);
    setPending(true);
    try {
      const result = await signUp(v.name, v.email, v.password);
      if (result === 'signed_in') onSuccess();
      else onConfirmEmail();
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Création du compte impossible.');
    } finally {
      setPending(false);
    }
  });

  return (
    <form
      onSubmit={(e) => void submit(e)}
      noValidate
      className="flex flex-col gap-5"
      aria-labelledby="inscription-titre"
    >
      <h2 id="inscription-titre" className="text-h3">
        Créer mon compte
      </h2>
      {serverError ? <AuthError>{serverError}</AuthError> : null}
      <Field label="Prénom" error={errors.name?.message} required>
        <Input autoComplete="given-name" {...register('name')} />
      </Field>
      <Field label="Email" error={errors.email?.message} required>
        <Input type="email" autoComplete="email" inputMode="email" {...register('email')} />
      </Field>
      <Field label="Mot de passe" error={errors.password?.message} required>
        <Input type="password" autoComplete="new-password" {...register('password')} />
      </Field>
      <Button type="submit" variant="secondary" loading={pending} disabled={loading} className="self-start">
        Créer mon compte
      </Button>
    </form>
  );
}

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const { signInDemo, loading, authMode, canSignUp, demoAvailable } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [notice, setNotice] = useState<string>();
  const [demoError, setDemoError] = useState<string>();
  const [demoPending, setDemoPending] = useState(false);

  const demo = async () => {
    setDemoError(undefined);
    setDemoPending(true);
    try {
      await signInDemo();
      onSuccess();
    } catch (e) {
      setDemoError(e instanceof Error ? e.message : 'Démo indisponible.');
    } finally {
      setDemoPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {demoAvailable ? (
        <>
          <section aria-labelledby="demo-titre" className="border-2 border-ink bg-gold-soft p-5 shadow-hard">
            <h2 id="demo-titre" className="text-h3">
              Essayer sans créer de compte
            </h2>
            <p className="mt-2 text-meta text-ink">
              Ouvre le projet de démonstration « Dar Hmeti », un court métrage fictif tourné à Tunis, avec le
              compte de Yassine.
            </p>
            {demoError ? (
              <p role="alert" className="mt-2 text-meta font-semibold text-bad-fg">
                {demoError}
              </p>
            ) : null}
            <Button
              className="mt-4 w-full sm:w-auto"
              onClick={() => void demo()}
              loading={demoPending}
              disabled={loading}
              iconRight="arrowRight"
            >
              Continuer en démo
            </Button>
          </section>

          <div className="flex items-center gap-4" aria-hidden>
            <span className="h-0.5 flex-1 bg-line-light" />
            <span className="eyebrow text-muted-on-light">ou</span>
            <span className="h-0.5 flex-1 bg-line-light" />
          </div>
        </>
      ) : null}

      {notice ? <AuthNotice>{notice}</AuthNotice> : null}

      {mode === 'signin' ? (
        <SignInForm onSuccess={onSuccess} />
      ) : (
        <SignUpForm
          onSuccess={onSuccess}
          onConfirmEmail={() => {
            setNotice('Compte créé. Confirme ton email avec le lien reçu, puis connecte-toi.');
            setMode('signin');
          }}
        />
      )}

      {canSignUp ? (
        <p className="text-meta">
          {mode === 'signin' ? 'Pas encore de compte ? ' : 'Tu as déjà un compte ? '}
          <button
            type="button"
            className="min-h-11 font-semibold underline underline-offset-4"
            onClick={() => {
              setNotice(undefined);
              setMode(mode === 'signin' ? 'signup' : 'signin');
            }}
          >
            {mode === 'signin' ? 'Créer un compte' : 'Se connecter'}
          </button>
        </p>
      ) : null}

      <p className="flex items-start gap-2 border-l-4 border-gold pl-3 text-meta text-muted-on-light">
        <Icon name="info" size={16} className="mt-0.5 shrink-0" />
        {authMode === 'supabase'
          ? `Ton compte est géré par Supabase Auth : ton mot de passe n’est jamais visible ni conservé en clair par ${brand.name}.`
          : 'Prototype : la connexion est simulée dans ton navigateur. Ton mot de passe n’est ni envoyé ni enregistré.'}
      </p>
    </div>
  );
}
