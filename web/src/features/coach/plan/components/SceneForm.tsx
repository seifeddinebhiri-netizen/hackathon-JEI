import { zodResolver } from '@hookform/resolvers/zod';
import { useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { Location, Scene, ShotSpecRequest } from '@/api/types';
import { Button, CharCount, ErrorState, Field, Input, Select, TextArea } from '@/components/ui';
import { cn } from '@/lib/cn';
import { sceneToRequest } from '../sceneDefaults';
import { EMPTY, fromRequest, MOODS, schema, STYLES, toRequest, type Values } from '../sceneValues';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t-2 border-ink pt-5 first:border-t-0 first:pt-0">
      <h3 className="font-display text-h3 font-bold">{title}</h3>
      {children}
    </section>
  );
}

/** Étape 1 : décrire la scène et tout ce qui aide l'IA (ambiance, style, intention, lumière...). */
export function SceneForm({
  scenes,
  locations,
  usedScenes,
  initial,
  pending,
  error,
  onSubmit,
}: {
  scenes: Scene[];
  locations: Location[];
  /** Scènes déjà prises par un autre espace de travail (identifiant → nom de l'espace). */
  usedScenes?: ReadonlyMap<string, string>;
  initial?: ShotSpecRequest;
  pending: boolean;
  error?: unknown;
  onSubmit: (request: ShotSpecRequest) => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: fromRequest(initial) });

  const mood = useWatch({ control, name: 'mood' });
  const description = useWatch({ control, name: 'description' });
  const motion = useWatch({ control, name: 'motion' });
  // Identifiant de la scène du planning reprise (pour retrouver le plan plus tard), s'il y en a une.
  const pickedScene = useRef<string | undefined>(initial?.scene_id);

  const pick = (id: string) => {
    const scene = scenes.find((s) => s.id === id);
    if (!scene) {
      pickedScene.current = undefined;
      return reset({ ...EMPTY });
    }
    reset(
      fromRequest(
        sceneToRequest(
          scene,
          locations.find((l) => l.id === scene.location_id),
        ),
      ),
    );
    pickedScene.current = id;
  };

  return (
    <form
      noValidate
      onSubmit={(e) => void handleSubmit((v) => onSubmit(toRequest(v, pickedScene.current)))(e)}
      className="flex flex-col gap-6"
      aria-label="Décrire la scène"
    >
      <Section title="1. Ta scène">
        {scenes.length > 0 ? (
          <Field
            label="Reprendre une scène de ton planning"
            optional
            hint="Les champs se remplissent, tu peux ensuite les compléter."
          >
            <Select defaultValue="" onChange={(e) => pick(e.target.value)}>
              <option value="">Écrire une scène libre</option>
              {scenes.map((s) => (
                <option key={s.id} value={s.id}>
                  {`Sc. ${s.number} · ${s.title}`}
                  {usedScenes?.has(s.id) ? ` (déjà dans « ${usedScenes.get(s.id)} »)` : ''}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field label="Que se passe-t-il dans la scène ?" error={errors.description?.message} required>
          <TextArea
            rows={5}
            placeholder="Ex. : Un vieil homme boit son thé seul dans un café de la médina. Il attend quelqu'un qui ne viendra pas."
            {...register('description')}
          />
        </Field>
        <CharCount value={description} limit={2000} />
      </Section>

      <Section title="2. Le contexte">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Intérieur ou extérieur" optional>
            <Select {...register('setting')}>
              <option value="unknown">Je ne sais pas</option>
              <option value="INT">Intérieur</option>
              <option value="EXT">Extérieur</option>
            </Select>
          </Field>
          <Field label="Moment de la journée" optional>
            <Select {...register('moment')}>
              <option value="">Non précisé</option>
              <option value="jour">Jour</option>
              <option value="aube">Aube</option>
              <option value="heure_doree">Heure dorée</option>
              <option value="nuit">Nuit</option>
            </Select>
          </Field>
        </div>
        <Field label="Endroit" optional error={errors.location?.message}>
          <Input placeholder="Ex. : café de la médina de Tunis" {...register('location')} />
        </Field>
        <Field
          label="Personnages à l'image"
          optional
          hint="Sépare les noms par une virgule."
          error={errors.characters?.message}
        >
          <Input placeholder="Amira, Mounir" {...register('characters')} />
        </Field>
      </Section>

      <Section title="3. L'ambiance">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-meta font-semibold">
            Ambiance <span className="font-normal text-muted-on-light">(facultatif, 5 au maximum)</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {MOODS.map((m) => {
              const on = mood.includes(m);
              return (
                <label
                  key={m}
                  className={cn(
                    'flex min-h-11 cursor-pointer items-center border-2 border-ink px-3 text-meta font-semibold has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-gold',
                    on ? 'bg-ink text-paper' : 'bg-white text-ink hover:bg-gold-soft',
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={on}
                    onChange={() =>
                      setValue('mood', on ? mood.filter((x) => x !== m) : [...mood, m], {
                        shouldValidate: true,
                      })
                    }
                  />
                  {m}
                </label>
              );
            })}
          </div>
          {errors.mood?.message ? (
            <p className="text-meta font-semibold text-bad-fg">{errors.mood.message}</p>
          ) : null}
        </fieldset>
        <Field label="Une autre ambiance" optional error={errors.moodOther?.message}>
          <Input placeholder="Ex. : fébrile" {...register('moodOther')} />
        </Field>
        <Field label="Style visuel" optional>
          <Input list="coach-styles" placeholder="Ex. : documentaire" {...register('visual_style')} />
        </Field>
        <datalist id="coach-styles">
          {STYLES.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <Field label="Ce que le spectateur doit ressentir" optional error={errors.intention?.message}>
          <TextArea
            rows={3}
            placeholder="Ex. : la solitude, le poids de l'attente."
            {...register('intention')}
          />
        </Field>
      </Section>

      <Section title="4. La prise de vue">
        <Field label="Lumière disponible" optional>
          <Input
            placeholder="Ex. : fenêtre à gauche, lumière dorée de fin de journée"
            {...register('light')}
          />
        </Field>
        <Field
          label="Mouvement de la caméra"
          optional
          hint="Plan fixe : la caméra ne bouge pas, un seul cadrage à viser. Plan en mouvement : l'IA décrit ta prise seconde par seconde (qui apparaît, où, avec quel angle)."
        >
          <Select {...register('motion')}>
            <option value="unknown">Je ne sais pas</option>
            <option value="fixed">Plan fixe</option>
            <option value="moving">Plan en mouvement</option>
          </Select>
        </Field>
        {motion === 'moving' ? (
          <Field
            label="Durée estimée de la scène (en secondes)"
            required
            hint="Les passages de ton plan se comptent depuis le début de la prise : plus la durée est juste, mieux le plan colle."
            error={errors.duration?.message}
          >
            <Input inputMode="decimal" placeholder="Ex. : 10" {...register('duration')} />
          </Field>
        ) : null}
        <Field label="Matériel d'appui" optional>
          <Select {...register('support')}>
            <option value="unknown">Je ne sais pas</option>
            <option value="handheld">À main levée</option>
            <option value="tripod">Sur trépied</option>
          </Select>
        </Field>
      </Section>

      <p className="border-l-4 border-gold pl-3 text-meta text-muted-on-light">
        Le texte de ta scène est envoyé à l'IA (Google Gemini) pour proposer le plan. Évite d'y mettre des
        informations privées ou confidentielles. Avec un compte, la scène est aussi enregistrée dans ton
        espace de travail. Les images de ta caméra, elles, ne quittent jamais ton téléphone.
      </p>

      {error ? <ErrorState title="Le plan n’a pas pu être généré" error={error} /> : null}

      <Button type="submit" size="lg" loading={pending} className="self-start">
        {pending ? 'L’IA prépare ton plan…' : 'Générer le plan'}
      </Button>
      {pending ? (
        <p role="status" className="text-meta text-muted-on-light">
          Cela peut prendre une vingtaine de secondes.
        </p>
      ) : null}
    </form>
  );
}
