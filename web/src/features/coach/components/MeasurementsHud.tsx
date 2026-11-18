import type { Measurements } from '../measure/compare';
import type { FaceStatus } from '../measure/useFaceDetector';

const n = (v: number | null, digits = 1, signed = false) =>
  v === null ? '–' : `${signed && v >= 0 ? '+' : ''}${v.toFixed(digits)}`;

const FACE_STATUS: Record<FaceStatus, string> = {
  idle: 'arrêté',
  loading: 'modèle en chargement…',
  ready: 'modèle prêt',
  error: 'modèle indisponible',
};

/** Relevé des mesures en direct : sert à vérifier les capteurs (les signes, les valeurs) sur un vrai téléphone. */
export function MeasurementsHud({
  m,
  faceStatus,
  mountNote,
}: {
  m: Measurements;
  faceStatus: FaceStatus;
  /** Montage sur caméra (inclinaison appliquée à l'angle), s'il y en a un. */
  mountNote?: string;
}) {
  const sensors = m.pitch === null ? 'aucun signal (autorisation refusée ou capteur absent)' : null;
  return (
    <pre
      aria-label="Mesures en direct"
      className="pointer-events-none absolute top-2 left-2 font-mono text-label leading-snug whitespace-pre-wrap text-paper [text-shadow:0_1px_6px_rgb(18_17_16/0.95)]"
    >
      {`Inclinaison : ${sensors ?? `horizon ${n(m.roll, 1, true)}°  angle ${n(m.pitch, 1, true)}°`}
Tremblement : ${n(m.shake, 3)} rad/s
Luminosité ${n(m.luma, 2)}  contraste ${n(m.contrast, 2)}
Chaleur ${n(m.warmth, 2, true)}  brûlé ${n(m.clipHigh === null ? null : m.clipHigh * 100, 0)} %  bouché ${n(m.clipLow === null ? null : m.clipLow * 100, 0)} %
Visage : ${m.face ? `x ${n(m.face.centerX, 2)}  tête ${n(m.face.headroom, 2)}  haut. ${n(m.face.height, 2)}` : 'aucun'}  (${FACE_STATUS[faceStatus]})
Contre-jour : ${n(m.backlightRatio, 1)}×${mountNote ? `\nMontage : ${mountNote}` : ''}`}
    </pre>
  );
}
