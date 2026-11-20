/**
 * Fiche de tournage d'une scène : l'IA lit le texte de la scène et écrit ce qui se passe, ce qu'on
 * voit, les accessoires, costumes, figurants, sons, éléments particuliers et points d'attention.
 * Rien n'est inventé ; tout reste modifiable et est enregistré avec la scène.
 */
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/api';
import type { LocationSuggestInput, Scene, SceneDetail } from '@/api/types';
import { AiDraftBadge, Button, Field, Input, TextArea } from '@/components/ui';

type ListKey = 'props' | 'costumes' | 'sound' | 'special' | 'watch_out';

const LIST_FIELDS: { key: ListKey; label: string; hint: string }[] = [
  { key: 'props', label: 'Accessoires', hint: 'Séparés par des virgules' },
  { key: 'costumes', label: 'Costumes et maquillage', hint: 'Séparés par des virgules' },
  { key: 'sound', label: 'Son', hint: 'Séparés par des virgules' },
  { key: 'special', label: 'Véhicules, animaux, effets', hint: 'Séparés par des virgules' },
];

/** Liste « a, b » modifiable, appliquée à la sortie du champ. */
function ListInput({
  value,
  onCommit,
  ...rest
}: {
  value: string[];
  onCommit: (v: string[]) => void;
  'aria-describedby'?: string;
}) {
  const [text, setText] = useState(value.join(', '));
  return (
    <Input
      {...rest}
      value={text}
      placeholder="Non précisé"
      onChange={(e) => setText(e.target.value)}
      onBlur={() =>
        onCommit(
          text
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        )
      }
    />
  );
}

export function SceneDetailSheet({
  scene,
  film,
  decor,
  onChange,
}: {
  scene: Scene;
  film: LocationSuggestInput['film'];
  decor: string;
  onChange: (detail: SceneDetail | undefined) => void;
}) {
  const detail = scene.detail;
  const ask = useMutation({
    mutationFn: () =>
      api.detailScene({
        film,
        scene: {
          number: scene.number,
          title: scene.title,
          setting: scene.setting,
          moment: scene.moment,
          decor,
          summary: scene.summary,
          characters: scene.characters,
          ...(scene.excerpt ? { excerpt: scene.excerpt.slice(0, 1200) } : {}),
        },
      }),
    onSuccess: (d) => onChange(d),
  });
  const set = <K extends keyof SceneDetail>(k: K, v: SceneDetail[K]) =>
    detail && onChange({ ...detail, [k]: v });

  if (!detail)
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          icon="sparkle"
          loading={ask.isPending}
          onClick={() => ask.mutate()}
        >
          Détailler la scène
          <span className="sr-only"> {scene.number}</span>
        </Button>
        {ask.isPending ? (
          <span role="status" className="text-meta text-muted-on-light">
            L’IA lit la scène…
          </span>
        ) : !scene.excerpt && !scene.summary ? (
          <span className="text-meta text-muted-on-light">Ajoute un résumé pour une fiche plus utile.</span>
        ) : null}
        {ask.isError ? (
          <p role="alert" className="w-full text-meta font-semibold text-bad-fg">
            {ask.error.message}
          </p>
        ) : null}
      </div>
    );

  // La clé force les champs à reprendre les valeurs après « Refaire la fiche »
  const k = `${scene.id}-${detail.what_happens.length}-${detail.props.length}`;
  return (
    <section aria-label={`Fiche de tournage de la scène ${scene.number}`} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display text-h3 font-bold">
          Fiche de tournage <AiDraftBadge />
        </h3>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            size="sm"
            icon="sparkle"
            loading={ask.isPending}
            onClick={() => ask.mutate()}
          >
            Refaire la fiche
          </Button>
          <Button variant="ghost" size="sm" icon="trash" onClick={() => onChange(undefined)}>
            Retirer la fiche
          </Button>
        </div>
      </div>
      {ask.isError ? (
        <p role="alert" className="text-meta font-semibold text-bad-fg">
          {ask.error.message}
        </p>
      ) : null}
      <div key={k} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Ce qui se passe" className="md:col-span-2">
          <TextArea
            rows={4}
            value={detail.what_happens}
            onChange={(e) => set('what_happens', e.target.value)}
          />
        </Field>
        <Field label="À l’image" optional className="md:col-span-2">
          <Input
            value={detail.on_screen}
            placeholder="Non précisé"
            onChange={(e) => set('on_screen', e.target.value)}
          />
        </Field>
        {LIST_FIELDS.map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint} optional>
            <ListInput value={detail[f.key]} onCommit={(v) => set(f.key, v)} />
          </Field>
        ))}
        <Field label="Figurants" optional className="md:col-span-2">
          <Input
            value={detail.extras}
            placeholder="Non précisé"
            onChange={(e) => set('extras', e.target.value)}
          />
        </Field>
        <Field label="À prévoir" hint="Un point par ligne" optional className="md:col-span-2">
          <TextArea
            rows={3}
            defaultValue={detail.watch_out.join('\n')}
            placeholder="Non précisé"
            onBlur={(e) =>
              set(
                'watch_out',
                e.target.value
                  .split('\n')
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
          />
        </Field>
      </div>
      <p className="text-meta text-muted-on-light">
        Écrite à partir du texte de la scène : relis-la. Un champ vide veut dire « non précisé dans le
        scénario ».
      </p>
    </section>
  );
}
