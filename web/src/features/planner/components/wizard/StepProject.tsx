import { zodResolver } from '@hookform/resolvers/zod';
import { addDays, differenceInCalendarDays, parseISO } from 'date-fns';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import type { CreateProjectInput, Project } from '@/api/types';
import { Button, Field, Icon, Input, SegmentedControl } from '@/components/ui';
import { isoDay } from '@/lib/format';

const schema = z
  .object({
    title: z.string().trim().min(1, 'Donne un titre, même provisoire.'),
    format: z.enum(['court', 'long']),
    city: z.string().trim().min(2, 'Indique la ville du tournage.'),
    shooting_window: z.object({
      from: z.string().min(1, 'Date de début requise.'),
      to: z.string().min(1, 'Date de fin requise.'),
    }),
    max_hours_per_day: z
      .number({ error: 'Indique un nombre d’heures.' })
      .min(2, '2 h minimum.')
      .max(14, '14 h maximum.'),
  })
  .refine((v) => v.shooting_window.to >= v.shooting_window.from, {
    path: ['shooting_window', 'to'],
    message: 'La fin doit être après le début.',
  })
  .refine(
    (v) => differenceInCalendarDays(parseISO(v.shooting_window.to), parseISO(v.shooting_window.from)) <= 90,
    {
      path: ['shooting_window', 'to'],
      message: 'Période de 90 jours maximum.',
    },
  );

export function StepProject({
  project,
  onSubmit,
  saving,
}: {
  project?: Project;
  onSubmit: (v: CreateProjectInput) => void;
  saving?: boolean;
}) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateProjectInput>({
    resolver: zodResolver(schema),
    defaultValues: project
      ? {
          title: project.title,
          format: project.format,
          city: project.city,
          shooting_window: project.shooting_window,
          max_hours_per_day: project.max_hours_per_day,
        }
      : {
          title: '',
          format: 'court',
          city: 'Tunis',
          shooting_window: { from: isoDay(addDays(new Date(), 7)), to: isoDay(addDays(new Date(), 28)) },
          max_hours_per_day: 8,
        },
  });

  return (
    <form
      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
      noValidate
      className="flex max-w-2xl flex-col gap-6"
    >
      <Field label="Titre du film" error={errors.title?.message} required>
        <Input placeholder="Titre provisoire" {...register('title')} />
      </Field>
      <Controller
        control={control}
        name="format"
        render={({ field }) => (
          <SegmentedControl
            legend="Format"
            value={field.value}
            onChange={field.onChange}
            options={[
              { value: 'court', label: 'Court métrage' },
              { value: 'long', label: 'Long métrage' },
            ]}
          />
        )}
      />
      <Field
        label="Ville du tournage"
        hint="Sert à la météo et aux heures du soleil."
        error={errors.city?.message}
        required
      >
        <Input {...register('city')} />
      </Field>
      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-meta font-semibold">Période de tournage possible</legend>
        <Field label="Du" error={errors.shooting_window?.from?.message} required>
          <Input type="date" {...register('shooting_window.from')} />
        </Field>
        <Field label="Au" error={errors.shooting_window?.to?.message} required>
          <Input type="date" {...register('shooting_window.to')} />
        </Field>
      </fieldset>
      <Field
        label="Heures de tournage maximum par jour"
        hint="Temps de tournage effectif, hors installation et pauses."
        error={errors.max_hours_per_day?.message}
        required
      >
        <Input
          type="number"
          min={2}
          max={14}
          step={0.5}
          className="max-w-32"
          {...register('max_hours_per_day', { valueAsNumber: true })}
        />
      </Field>
      {project?.schedule ? (
        <p className="flex items-start gap-2 border-l-4 border-gold pl-3 text-meta text-muted-on-light">
          <Icon name="info" size={16} className="mt-0.5 shrink-0" />
          Période ou heures changées ? Régénère le planning à la fin.
        </p>
      ) : null}
      <Button type="submit" loading={saving} iconRight="arrowRight" className="self-start">
        {project ? 'Enregistrer et continuer' : 'Créer le film et continuer'}
      </Button>
    </form>
  );
}
