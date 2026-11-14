import { useState } from 'react';
import type { Location, Scene } from '@/api/types';
import { AiDraftBadge, Button, Checkbox, Field, Icon, Input, Select } from '@/components/ui';
import { cn } from '@/lib/cn';
import { MOMENT_LABELS } from '../../lib/labels';

/** Saisie « Amira, Slim » → ['Amira', 'Slim'], appliquée à la sortie du champ. */
function CharactersInput({ value, onCommit }: { value: string[]; onCommit: (v: string[]) => void }) {
  const [text, setText] = useState(value.join(', '));
  return (
    <Input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() =>
        onCommit(
          text
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        )
      }
      placeholder="Amira, Slim"
    />
  );
}

export function SceneEditor({
  scene,
  locations,
  onChange,
  onDelete,
}: {
  scene: Scene;
  locations: Location[];
  onChange: (s: Scene) => void;
  onDelete: () => void;
}) {
  const set = <K extends keyof Scene>(k: K, v: Scene[K]) => onChange({ ...scene, [k]: v });
  const draft = scene.source === 'import_ia' && !scene.validated;
  const missingLoc = !locations.some((l) => l.id === scene.location_id);

  return (
    <article
      aria-label={`Scène ${scene.number}`}
      className={cn('border-2 bg-white p-4 md:p-5', draft ? 'border-dashed border-ink' : 'border-ink')}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-h3 font-bold">Scène {scene.number}</p>
        <div className="flex items-center gap-2">
          {scene.source === 'import_ia' ? <AiDraftBadge validated={scene.validated} /> : null}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-12">
        <Field label="N°" className="col-span-1 md:col-span-1">
          <Input value={scene.number} onChange={(e) => set('number', e.target.value)} />
        </Field>
        <Field label="Titre court" className="col-span-1 md:col-span-5">
          <Input value={scene.title} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Field label="INT / EXT" className="col-span-1 md:col-span-2">
          <Select value={scene.setting} onChange={(e) => set('setting', e.target.value as Scene['setting'])}>
            <option value="INT">INT · Intérieur</option>
            <option value="EXT">EXT · Extérieur</option>
          </Select>
        </Field>
        <Field label="Moment" className="col-span-1 md:col-span-2">
          <Select value={scene.moment} onChange={(e) => set('moment', e.target.value as Scene['moment'])}>
            {Object.entries(MOMENT_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Durée (h)" hint="Tournage estimé" className="col-span-1 md:col-span-2">
          <Input
            type="number"
            min={0.25}
            max={14}
            step={0.25}
            value={scene.estimated_hours}
            onChange={(e) => set('estimated_hours', Number(e.target.value) || 0)}
          />
        </Field>
        <Field
          label="Lieu"
          error={missingLoc ? 'Choisis un lieu.' : undefined}
          className="col-span-2 md:col-span-5"
        >
          <Select
            value={missingLoc ? '' : scene.location_id}
            onChange={(e) => set('location_id', e.target.value)}
          >
            <option value="" disabled>
              Choisir un lieu…
            </option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Personnages" hint="Séparés par des virgules" className="col-span-2 md:col-span-7">
          <CharactersInput value={scene.characters} onCommit={(v) => set('characters', v)} />
        </Field>
        <Field label="Résumé en une ligne" className="col-span-2 md:col-span-12">
          <Input value={scene.summary} onChange={(e) => set('summary', e.target.value)} />
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t-2 border-line-light pt-3">
        <Checkbox
          checked={scene.validated}
          onCheckedChange={(v) => set('validated', v)}
          label={<span className="font-semibold">J’ai relu cette scène</span>}
        />
        <Button variant="ghost" size="sm" icon="trash" onClick={onDelete}>
          Supprimer
          <span className="sr-only"> la scène {scene.number}</span>
        </Button>
      </div>
    </article>
  );
}

export function SceneSummaryBar({
  scenes,
  onValidateAll,
  onAdd,
}: {
  scenes: Scene[];
  onValidateAll: () => void;
  onAdd: () => void;
}) {
  const toReview = scenes.filter((s) => !s.validated).length;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-2 border-ink bg-paper p-4">
      <p className="flex items-center gap-2 font-semibold">
        <Icon name="film" size={18} />
        {scenes.length} scène{scenes.length > 1 ? 's' : ''}
        {toReview ? (
          <span className="font-normal text-muted-on-light"> · {toReview} à relire</span>
        ) : scenes.length ? (
          <span className="font-normal text-ok-fg"> · toutes relues</span>
        ) : null}
      </p>
      <div className="flex flex-wrap gap-2">
        {toReview ? (
          <Button variant="secondary" size="sm" icon="check" onClick={onValidateAll}>
            Tout marquer comme relu
          </Button>
        ) : null}
        <Button variant="secondary" size="sm" icon="plus" onClick={onAdd}>
          Ajouter une scène
        </Button>
      </div>
    </div>
  );
}
