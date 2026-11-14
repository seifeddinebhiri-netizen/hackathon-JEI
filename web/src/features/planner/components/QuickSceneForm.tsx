import { zodResolver } from '@hookform/resolvers/zod';
import { addDays, differenceInCalendarDays, parseISO } from 'date-fns';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import type { QuickSlotRequest } from '@/api/types';
import { Button, Field, Input, SegmentedControl, TextArea } from '@/components/ui';
import { isoDay } from '@/lib/format';
import { MOMENT_OPTIONS, SETTING_OPTIONS } from '../lib/options';

const schema = z
  .object({
    description: z.string().trim().min(5, 'Décris la scène en quelques mots.'),
    place: z.string().trim().min(2, 'Indique une ville ou une adresse.'),
    setting: z.enum(['INT', 'EXT']),
    moment: z.enum(['jour', 'nuit', 'aube', 'heure_doree']),
    from: z.string().min(1, 'Date de début requise.'),
    to: z.string().min(1, 'Date de fin requise.'),
  })
  .refine((v) => v.to >= v.from, { path: ['to'], message: 'La fin doit être après le début.' })
  .refine((v) => differenceInCalendarDays(parseISO(v.to), parseISO(v.from)) <= 30, {
    path: ['to'],
    message: 'Période de 31 jours maximum.',
  });

export function QuickSceneForm({
  onSubmit,
  loading,
  defaultPlace,
}: {
  onSubmit: (req: QuickSlotRequest) => void;
  loading?: boolean;
  defaultPlace?: string;
}) {
  const today = new Date();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<QuickSlotRequest>({
    resolver: zodResolver(schema),
    defaultValues: {
      description: '',
      place: defaultPlace ?? 'Tunis',
      setting: 'EXT',
      moment: 'heure_doree',
      from: isoDay(addDays(today, 1)),
      to: isoDay(addDays(today, 14)),
    },
  });

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate className="flex flex-col gap-5">
      <Field label="La scène en quelques lignes" error={errors.description?.message} required>
        <TextArea
          rows={3}
          placeholder="Amira marche seule sur la plage et relit la lettre de son père."
          {...register('description')}
        />
      </Field>
      <Field label="Lieu" hint="Une ville ou une adresse." error={errors.place?.message} required>
        <Input autoComplete="off" {...register('place')} />
      </Field>
      <Controller
        control={control}
        name="setting"
        render={({ field }) => (
          <SegmentedControl
            legend="Intérieur ou extérieur"
            value={field.value}
            onChange={field.onChange}
            options={SETTING_OPTIONS}
          />
        )}
      />
      <Controller
        control={control}
        name="moment"
        render={({ field }) => (
          <SegmentedControl
            legend="Moment voulu"
            value={field.value}
            onChange={field.onChange}
            options={MOMENT_OPTIONS}
          />
        )}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="À partir du" error={errors.from?.message} required>
          <Input type="date" {...register('from')} />
        </Field>
        <Field label="Jusqu’au" error={errors.to?.message} required>
          <Input type="date" {...register('to')} />
        </Field>
      </div>
      <Button type="submit" loading={loading} icon="sun" className="self-start">
        Trouver les meilleurs créneaux
      </Button>
    </form>
  );
}
