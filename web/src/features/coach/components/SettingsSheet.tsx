import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';
import { ADJUST_FIELDS, type Adjust } from '../imageFilter';
import { clampTilt, describeTilt, MOUNT_OPTIONS, MOUNT_TILT, type Mount, type MountKind } from '../mount';
import type { SettingItem, SettingKey } from '../useCameraSettings';

type Props = {
  /** Réglages matériels de la caméra (selon l'appareil). */
  items: SettingItem[];
  missing: string[];
  exposed: string[];
  highlight: SettingKey[];
  onRange: (key: Extract<SettingItem, { kind: 'range' }>['key'], value: number) => void;
  onSwitch: (key: Extract<SettingItem, { kind: 'switch' }>['key'], on: boolean) => void;
  /** Retouche de l'image par logiciel (marche partout). */
  retouch: { on: boolean; supported: boolean; locked: boolean; adjust: Adjust };
  highlightAdjust: (keyof Adjust)[];
  onRetouchToggle: (on: boolean) => void;
  onAdjust: (key: keyof Adjust, value: number) => void;
  /** Définition de l'enregistrement : 1080p (haute) ou 720p (plus fluide sur un téléphone modeste). */
  quality: { value: '1080' | '720'; locked: boolean };
  onQuality: (q: '1080' | '720') => void;
  /** Montage du téléphone sur une vraie caméra (corrige l'angle). */
  mount: Mount;
  onMount: (m: Mount) => void;
  /** Relevé des mesures en direct (diagnostic). */
  hud: boolean;
  onHud: (on: boolean) => void;
  onReset: () => void;
  onClose: () => void;
};

const flat = 'text-paper hover:bg-paper/10';

function Heading({ children }: { children: string }) {
  return <p className="eyebrow mt-3 text-gold first:mt-0">{children}</p>;
}

/** Réglages de la caméra : retouche logicielle (tous téléphones) puis réglages matériels (selon l'appareil). */
export function SettingsSheet(p: Props) {
  return (
    <section
      aria-label="Réglages de la caméra"
      className="max-h-[50vh] overflow-y-auto border-2 border-line-dark bg-ink/20 p-3 text-paper [text-shadow:0_1px_6px_rgb(18_17_16/0.9)]"
    >
      <div className="flex items-center justify-between">
        <p className="font-display text-h3 font-bold">Réglages</p>
        <div className="flex">
          <Button variant="ghost" size="sm" className={flat} onClick={p.onReset}>
            Réinitialiser
          </Button>
          <Button variant="ghost" size="sm" className={flat} onClick={p.onClose}>
            Fermer
          </Button>
        </div>
      </div>

      <Heading>Montage du téléphone</Heading>
      <label className="flex flex-col gap-1 py-1 text-meta">
        Comment filmes-tu ?
        <select
          value={p.mount.kind}
          onChange={(e) => p.onMount({ ...p.mount, kind: e.target.value as MountKind })}
          className="min-h-11 border-2 border-paper/70 bg-ink/60 px-2 text-paper"
        >
          {MOUNT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {p.mount.kind !== 'phone' ? (
        <label className="flex flex-col text-meta">
          <span>
            Inclinaison : <span className="font-mono text-label">{describeTilt(p.mount.tiltDeg)}</span>
          </span>
          <input
            type="range"
            min={MOUNT_TILT.min}
            max={MOUNT_TILT.max}
            step={MOUNT_TILT.step}
            value={p.mount.tiltDeg}
            onChange={(e) => p.onMount({ ...p.mount, tiltDeg: clampTilt(Number(e.target.value)) })}
            className="h-11 w-full accent-gold"
          />
          <span className="text-label text-muted-on-dark">
            + : le téléphone regarde plus haut que ta caméra. Corrige le calcul de l’angle.
          </span>
        </label>
      ) : null}

      <Heading>Diagnostic</Heading>
      <label className="flex min-h-11 items-center justify-between gap-3 text-meta">
        <span>
          Afficher les mesures en direct
          <span className="block text-label text-muted-on-dark">
            Inclinaison, luminosité, visage : pour vérifier les capteurs.
          </span>
        </span>
        <input
          type="checkbox"
          checked={p.hud}
          onChange={(e) => p.onHud(e.target.checked)}
          className="size-6 shrink-0 accent-gold"
        />
      </label>

      <Heading>Définition de l’enregistrement</Heading>
      <div className="flex gap-2 py-1" role="group" aria-label="Définition de l’enregistrement">
        {(['1080', '720'] as const).map((q) => (
          <Button
            key={q}
            variant="on-dark"
            size="sm"
            aria-pressed={p.quality.value === q}
            disabled={p.quality.locked}
            className={p.quality.value === q ? 'bg-paper text-ink' : ''}
            onClick={() => p.onQuality(q)}
          >
            {q === '1080' ? '1080p · haute' : '720p · plus fluide'}
          </Button>
        ))}
      </div>
      <p className="text-label text-muted-on-dark">
        Si ta vidéo saccade, essaie 720p. Impossible pendant une prise.
      </p>

      <Heading>Retouche de l’image</Heading>
      <label className="flex min-h-11 items-center justify-between gap-3 text-meta">
        <span>
          Retoucher l’image en direct
          <span className="block text-label text-muted-on-dark">
            {p.retouch.supported
              ? 'Marche sur tous les téléphones. Appliquée à l’aperçu et à la vidéo. Éteinte : qualité maximale.'
              : 'Non disponible : ce navigateur n’a pas WebGL.'}
          </span>
        </span>
        <input
          type="checkbox"
          checked={p.retouch.on}
          disabled={!p.retouch.supported || p.retouch.locked}
          onChange={(e) => p.onRetouchToggle(e.target.checked)}
          className="size-6 shrink-0 accent-gold"
        />
      </label>
      {p.retouch.locked ? (
        <p className="text-label text-gold">Impossible de l’activer ou de l’éteindre pendant une prise.</p>
      ) : null}
      {p.retouch.on ? (
        <ul>
          {ADJUST_FIELDS.map((f) => (
            <li key={f.key}>
              <label className="flex items-center gap-3 text-meta">
                <span
                  className={cn(
                    'w-28 shrink-0',
                    p.highlightAdjust.includes(f.key) && 'font-semibold text-gold',
                  )}
                >
                  {f.label}
                </span>
                <input
                  type="range"
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  value={p.retouch.adjust[f.key]}
                  onChange={(e) => p.onAdjust(f.key, Number(e.target.value))}
                  className="h-11 min-w-0 flex-1 accent-gold"
                />
                <span className="w-12 text-right font-mono text-label">
                  {Number(p.retouch.adjust[f.key].toFixed(2))}
                </span>
              </label>
            </li>
          ))}
        </ul>
      ) : null}

      <Heading>Réglages de l’appareil</Heading>
      {p.items.length === 0 ? (
        <p className="text-meta text-muted-on-dark">
          Ce téléphone ne propose aucun réglage matériel au navigateur (c’est le cas de Safari sur iPhone).
          Utilise la retouche ci-dessus, ou touche l’écran dans l’appli Appareil photo puis glisse le petit
          soleil.
        </p>
      ) : (
        <ul>
          {p.items.map((it) => (
            <li key={it.key}>
              {it.kind === 'range' ? (
                <label className="flex items-center gap-3 text-meta">
                  <span
                    className={cn('w-28 shrink-0', p.highlight.includes(it.key) && 'font-semibold text-gold')}
                  >
                    {it.label}
                  </span>
                  <input
                    type="range"
                    min={it.min}
                    max={it.max}
                    step={it.step}
                    value={it.value}
                    onChange={(e) => p.onRange(it.key, Number(e.target.value))}
                    className="h-11 min-w-0 flex-1 accent-gold"
                  />
                  <span className="w-12 text-right font-mono text-label">{Number(it.value.toFixed(2))}</span>
                </label>
              ) : (
                <label className="flex min-h-11 items-center justify-between gap-3 text-meta">
                  <span className={cn(p.highlight.includes(it.key) && 'font-semibold text-gold')}>
                    {it.label}
                  </span>
                  <input
                    type="checkbox"
                    checked={it.on}
                    onChange={(e) => p.onSwitch(it.key, e.target.checked)}
                    className="size-6 accent-gold"
                  />
                </label>
              )}
            </li>
          ))}
        </ul>
      )}
      {p.items.length > 0 && p.missing.length > 0 ? (
        <p className="mt-2 text-label text-muted-on-dark">
          Non proposés par ce téléphone : {p.missing.join(', ')}.
        </p>
      ) : null}
      {p.items.length > 0 ? (
        <p className="mt-1 text-label text-muted-on-dark">
          Annoncé par le navigateur : {p.exposed.join(', ') || 'rien'}.
        </p>
      ) : null}
    </section>
  );
}
