import { useRef, useState } from 'react';
import { LocationWeather } from './LocationWeather';
import type { Location, PermitStatus, Project, Scene } from '@/api/types';
import {
  AiDraftBadge,
  Button,
  Checkbox,
  EmptyState,
  Field,
  Icon,
  Input,
  PhotoFrame,
  SegmentedControl,
  StatusChip,
  TextArea,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatDateNumeric } from '@/lib/format';
import { useGeocode } from '../../hooks/usePlanner';
import { localId } from '../../lib/ids';
import { PERMIT_LABELS, WEEKDAYS } from '../../lib/labels';
import { LocationSuggestions, type LocationSuggestionsHandle } from './LocationSuggestions';
import type { DraftSetter, PlannerDraft } from './types';

const PERMIT_OPTIONS = (Object.keys(PERMIT_LABELS) as PermitStatus[]).map((v) => ({
  value: v,
  label: PERMIT_LABELS[v],
}));

function LocationEditor({
  project,
  location,
  scenes,
  otherDecors,
  detected,
  onChange,
  onDelete,
}: {
  project: Project;
  location: Location;
  /** Scènes tournées dans ce décor */
  scenes: Scene[];
  /** Noms des autres décors du film (pour repérer un lieu qui peut servir deux fois) */
  otherDecors: string[];
  detected: boolean;
  onChange: (l: Location) => void;
  onDelete: () => void;
}) {
  const scenesCount = scenes.length;
  const addressId = `adresse-${location.id}`;
  const suggestions = useRef<LocationSuggestionsHandle>(null);
  const geocode = useGeocode();
  const [dateToAdd, setDateToAdd] = useState('');
  const set = <K extends keyof Location>(k: K, v: Location[K]) => onChange({ ...location, [k]: v });
  const weekdays = location.forbidden_days.filter((d) => (WEEKDAYS as readonly string[]).includes(d));
  const dates = location.forbidden_days.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const incomplete = !location.address.trim();

  const toggleWeekday = (w: string) =>
    set(
      'forbidden_days',
      weekdays.includes(w) ? location.forbidden_days.filter((d) => d !== w) : [...location.forbidden_days, w],
    );

  const locate = () =>
    geocode.mutate(location.address || location.name, {
      onSuccess: (r) => r[0] && onChange({ ...location, lat: r[0].lat, lon: r[0].lon }),
    });

  return (
    <article
      aria-label={`Lieu ${location.name || 'sans nom'}`}
      className={cn(
        'border-2 bg-white p-4 md:p-5',
        detected && incomplete ? 'border-dashed border-ink' : 'border-ink',
      )}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-h3 font-bold">{location.name || 'Nouveau lieu'}</p>
        <div className="flex flex-wrap items-center gap-2">
          {detected ? <AiDraftBadge validated={!incomplete} /> : null}
          <StatusChip tone="neutral" icon="film">
            {scenesCount} scène{scenesCount > 1 ? 's' : ''}
          </StatusChip>
        </div>
      </div>

      <LocationSuggestions
        project={project}
        location={location}
        scenes={scenes}
        otherDecors={otherDecors}
        onChange={onChange}
        addressInputId={addressId}
        ref={suggestions}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Nom du lieu" required>
          <Input value={location.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field
          label="Adresse ou ville"
          error={incomplete ? 'À compléter' : undefined}
          hint={
            location.lat !== undefined
              ? `Localisé (${location.lat.toFixed(3)}, ${location.lon?.toFixed(3)})`
              : 'Sert au calcul du soleil.'
          }
        >
          <Input id={addressId} value={location.address} onChange={(e) => set('address', e.target.value)} />
        </Field>
      </div>
      <Button
        variant="ghost"
        size="sm"
        icon="pin"
        loading={geocode.isPending}
        onClick={locate}
        className="mt-1"
      >
        Localiser ce lieu
      </Button>

      <LocationWeather
        project={project}
        location={location}
        scenes={scenes}
        onShelteredPlaces={() => suggestions.current?.askSheltered()}
      />

      <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <Checkbox
            checked={!!location.access_hours}
            onCheckedChange={(v) => set('access_hours', v ? { from: '08:00', to: '20:00' } : undefined)}
            label={<span className="font-semibold">Horaires d’accès limités</span>}
          />
          {location.access_hours ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="De">
                <Input
                  type="time"
                  value={location.access_hours.from}
                  onChange={(e) => set('access_hours', { ...location.access_hours!, from: e.target.value })}
                />
              </Field>
              <Field label="À">
                <Input
                  type="time"
                  value={location.access_hours.to}
                  onChange={(e) => set('access_hours', { ...location.access_hours!, to: e.target.value })}
                />
              </Field>
            </div>
          ) : null}
        </div>
        <SegmentedControl
          legend="Autorisation de tournage"
          value={location.permit}
          onChange={(v) => set('permit', v)}
          options={PERMIT_OPTIONS}
        />
      </div>

      <fieldset className="mt-5">
        <legend className="mb-2 text-meta font-semibold">Jours interdits</legend>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((w) => {
            const on = weekdays.includes(w);
            return (
              <button
                key={w}
                type="button"
                aria-pressed={on}
                onClick={() => toggleWeekday(w)}
                className={cn(
                  'inline-flex min-h-11 items-center gap-1 border-2 px-3 text-meta font-semibold capitalize',
                  on ? 'border-bad-fg bg-bad-bg text-bad-fg' : 'border-line-light bg-white hover:border-ink',
                )}
              >
                {on ? <Icon name="x" size={14} /> : null}
                {w}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Field label="Ajouter une date précise">
            <Input type="date" value={dateToAdd} onChange={(e) => setDateToAdd(e.target.value)} />
          </Field>
          <Button
            variant="secondary"
            size="sm"
            icon="plus"
            disabled={!dateToAdd || dates.includes(dateToAdd)}
            onClick={() => {
              set('forbidden_days', [...location.forbidden_days, dateToAdd]);
              setDateToAdd('');
            }}
          >
            Ajouter
          </Button>
        </div>
        {dates.length ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {dates.map((d) => (
              <li key={d}>
                <button
                  type="button"
                  onClick={() =>
                    set(
                      'forbidden_days',
                      location.forbidden_days.filter((x) => x !== d),
                    )
                  }
                  className="inline-flex min-h-11 items-center gap-1.5 border-2 border-bad-fg bg-bad-bg px-3 text-meta font-semibold text-bad-fg"
                >
                  {formatDateNumeric(d)} <Icon name="x" size={14} />
                  <span className="sr-only">Retirer cette date</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </fieldset>

      <Field label="Notes" optional className="mt-5">
        <TextArea
          rows={2}
          value={location.notes ?? ''}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Contact, accès, parking…"
        />
      </Field>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t-2 border-line-light pt-3">
        {scenesCount > 0 ? (
          <p className="text-meta text-muted-on-light">
            Utilisé par {scenesCount} scène(s) : change leur lieu avant de le supprimer.
          </p>
        ) : null}
        <Button variant="ghost" size="sm" icon="trash" disabled={scenesCount > 0} onClick={onDelete}>
          Supprimer<span className="sr-only"> le lieu {location.name}</span>
        </Button>
      </div>
    </article>
  );
}

export function StepLocations({
  project,
  draft,
  setDraft,
  detected,
}: {
  project: Project;
  draft: PlannerDraft;
  setDraft: DraftSetter;
  detected: string[];
}) {
  const add = () =>
    setDraft((d) => ({
      ...d,
      locations: [
        ...d.locations,
        { id: localId('loc'), name: '', address: '', forbidden_days: [], permit: 'non_necessaire' },
      ],
    }));
  const toAsk = draft.locations.filter((l) => l.permit === 'a_demander').length;

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-6">
          <h2 className="text-h2">Tes lieux de tournage</h2>
          <p className="mt-3 max-w-prose text-muted-on-light">
            Horaires d’accès, jours interdits et autorisations : le planning en tient compte. Une autorisation
            encore « à demander » sera signalée en alerte sur chaque scène concernée.
          </p>
          {toAsk ? (
            <p className="mt-3 flex items-center gap-2 font-semibold text-warn-fg">
              <Icon name="doc" size={18} /> {toAsk} autorisation{toAsk > 1 ? 's' : ''} à demander
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-3 lg:col-span-6" aria-hidden={false}>
          <PhotoFrame photo="porte" ratio="3:2" sizes="(min-width: 1024px) 22vw, 50vw" />
          <PhotoFrame photo="drapeaux" ratio="3:2" sizes="(min-width: 1024px) 22vw, 50vw" className="mt-6" />
        </div>
      </div>

      {draft.locations.length === 0 ? (
        <EmptyState
          icon="pin"
          title="Aucun lieu"
          action={
            <Button icon="plus" onClick={add}>
              Ajouter un lieu
            </Button>
          }
        >
          Ajoute les lieux où tu vas tourner : un café, un appartement, une plage…
        </EmptyState>
      ) : (
        <>
          {draft.locations.map((l) => (
            <LocationEditor
              key={l.id}
              project={project}
              location={l}
              detected={detected.includes(l.id)}
              scenes={draft.scenes.filter((s) => s.location_id === l.id)}
              otherDecors={draft.locations.filter((x) => x.id !== l.id).map((x) => x.name)}
              onChange={(nl) =>
                setDraft((d) => ({ ...d, locations: d.locations.map((x) => (x.id === nl.id ? nl : x)) }))
              }
              onDelete={() =>
                setDraft((d) => ({ ...d, locations: d.locations.filter((x) => x.id !== l.id) }))
              }
            />
          ))}
          <Button variant="secondary" icon="plus" onClick={add} className="self-start">
            Ajouter un lieu
          </Button>
        </>
      )}
    </div>
  );
}
