import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, Field, Icon, Input } from '@/components/ui';
import { useAuth } from '../hooks/useAuth';

const schema = z.object({
  email: z.string().trim().min(1, 'Indique ton email.').email('Cet email n’a pas l’air valide.'),
  password: z.string().min(6, 'Au moins 6 caractères.'),
});
type Values = z.infer<typeof schema>;

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const { signIn, signInDemo, loading } = useAuth();
  const [serverError, setServerError] = useState<string>();
  const [pending, setPending] = useState<'form' | 'demo' | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  const submit = handleSubmit(async (v) => {
    setServerError(undefined);
    setPending('form');
    try {
      await signIn(v.email, v.password);
      onSuccess();
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Connexion impossible.');
    } finally {
      setPending(null);
    }
  });

  const demo = async () => {
    setPending('demo');
    try {
      await signInDemo();
      onSuccess();
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="demo-titre" className="border-2 border-ink bg-gold-soft p-5 shadow-hard">
        <h2 id="demo-titre" className="text-h3">
          Essayer sans compte
        </h2>
        <p className="mt-2 text-meta text-ink">
          Ouvre le projet de démonstration « Marée basse », un court métrage fictif tourné à Tunis, avec le
          compte de Yassine.
        </p>
        <Button
          className="mt-4 w-full sm:w-auto"
          onClick={() => void demo()}
          loading={pending === 'demo'}
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

      <form
        onSubmit={(e) => void submit(e)}
        noValidate
        className="flex flex-col gap-5"
        aria-labelledby="form-titre"
      >
        <h2 id="form-titre" className="text-h3">
          Se connecter avec un email
        </h2>
        {serverError ? (
          <p
            role="alert"
            className="flex items-center gap-2 border-2 border-bad-fg bg-bad-bg p-3 font-semibold text-bad-fg"
          >
            <Icon name="alert" size={18} />
            {serverError}
          </p>
        ) : null}
        <Field label="Email" error={errors.email?.message} required>
          <Input type="email" autoComplete="email" inputMode="email" {...register('email')} />
        </Field>
        <Field label="Mot de passe" error={errors.password?.message} required>
          <Input type="password" autoComplete="current-password" {...register('password')} />
        </Field>
        <Button
          type="submit"
          variant="secondary"
          loading={pending === 'form'}
          disabled={loading}
          className="self-start"
        >
          Se connecter
        </Button>
      </form>

      <p className="flex items-start gap-2 border-l-4 border-gold pl-3 text-meta text-muted-on-light">
        <Icon name="info" size={16} className="mt-0.5 shrink-0" />
        Prototype : la connexion est simulée dans ton navigateur. Ton mot de passe n’est ni envoyé ni
        enregistré.
      </p>
    </div>
  );
}
