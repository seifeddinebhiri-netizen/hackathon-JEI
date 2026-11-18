import { Field, Select } from '@/components/ui';
import { clampTilt, describeTilt, MOUNT_OPTIONS, MOUNT_TILT, type Mount, type MountKind } from '../../mount';

/** « Comment filmes-tu ? » : avec le téléphone seul, ou téléphone fixé sur une vraie caméra. */
export function MountPicker({ mount, onChange }: { mount: Mount; onChange: (m: Mount) => void }) {
  return (
    <section aria-label="Ton installation" className="flex flex-col gap-4 border-2 border-ink bg-white p-5">
      <h3 className="font-display text-h3 font-bold">Ton installation</h3>
      <Field label="Comment filmes-tu ?">
        <Select
          value={mount.kind}
          onChange={(e) => onChange({ ...mount, kind: e.target.value as MountKind })}
        >
          {MOUNT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
      {mount.kind !== 'phone' ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="mount-tilt" className="text-meta font-semibold">
            Inclinaison du téléphone : <span className="font-normal">{describeTilt(mount.tiltDeg)}</span>
          </label>
          <input
            id="mount-tilt"
            type="range"
            min={MOUNT_TILT.min}
            max={MOUNT_TILT.max}
            step={MOUNT_TILT.step}
            value={mount.tiltDeg}
            onChange={(e) => onChange({ ...mount, tiltDeg: clampTilt(Number(e.target.value)) })}
            className="h-11 w-full accent-action"
          />
          <p className="text-meta text-muted-on-light">
            Un léger réglage vers le haut ou vers le bas corrige le calcul de l’angle : le téléphone regarde
            un peu plus haut (+) ou un peu plus bas (−) que ta caméra. Les voyants de cadrage supposent que le
            téléphone voit à peu près la même image que ta caméra.
          </p>
        </div>
      ) : null}
    </section>
  );
}
