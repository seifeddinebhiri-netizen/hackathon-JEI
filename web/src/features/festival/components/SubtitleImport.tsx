import { useEffect, useState } from 'react';
import type { CreateSubtitleDraftInput, Project } from '@/api/types';
import { subtitlesSimulated } from '@/api';
import { Button, Checkbox, ErrorState, Field, FileDrop, Icon, Input, Spinner } from '@/components/ui';
import { useCreateSubtitleDraft } from '../hooks/useFestivals';
import { extractAudioWav, transcriptionLanguage, wavName } from '../lib/audio';
import { subtitleImportError } from '../lib/importErrors';
import { useVideoSession } from '../video/videoSession';

const MEDIA_EXTENSIONS = ['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.mp3', '.wav', '.m4a', '.aac', '.ogg'];
const PRIVACY_MESSAGE =
  'Seul le son de ton film est envoyé pour la transcription (ElevenLabs), puis traduit (Gemini, version de test). Ta vidéo reste sur ton ordinateur.';

type Phase = 'idle' | 'extracting' | 'sending' | 'processing';

function defaultKeyterms(project: Project): string {
  const names = new Set<string>();
  for (const p of project.people) if (p.character) names.add(p.character);
  return [...names].join(', ');
}

function useElapsed(running: boolean): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const t = setInterval(() => setSeconds(Math.round((Date.now() - started) / 1000)), 1000);
    return () => {
      clearInterval(t);
      setSeconds(0);
    };
  }, [running]);
  return seconds;
}

function duration(s: number): string {
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
}

const STEPS: { phase: Exclude<Phase, 'idle'>; label: string }[] = [
  { phase: 'extracting', label: 'Extraction du son' },
  { phase: 'sending', label: 'Envoi du son' },
  { phase: 'processing', label: 'Transcription et traduction' },
];

/** Progression de l'import, étape par étape. */
function ImportProgress({ phase, sent, elapsed }: { phase: Phase; sent: number | null; elapsed: number }) {
  const current = STEPS.findIndex((st) => st.phase === phase);
  const detail =
    phase === 'extracting'
      ? 'Ton navigateur lit la vidéo et garde seulement le son.'
      : phase === 'sending'
        ? sent === null
          ? 'Envoi en cours…'
          : `${Math.round(sent * 100)} % envoyé`
        : `Depuis ${duration(elapsed)}. Cela peut prendre une à plusieurs minutes : garde cette page ouverte.`;
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col gap-3 border-2 border-line-light bg-paper p-4"
    >
      <ol className="flex flex-wrap gap-x-6 gap-y-2 text-meta">
        {STEPS.map((st, i) => (
          <li
            key={st.phase}
            className={i === current ? 'font-semibold' : i < current ? 'text-ok-fg' : 'text-muted-on-light'}
          >
            <span className="inline-flex items-center gap-1.5">
              {i < current ? <Icon name="check" size={14} /> : i === current ? <Spinner /> : null}
              {i + 1}. {st.label}
            </span>
          </li>
        ))}
      </ol>
      {phase === 'sending' && sent !== null ? (
        <div
          role="progressbar"
          aria-label="Envoi du son"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(sent * 100)}
          className="h-2.5 w-full bg-line-light"
        >
          <div className="h-full bg-ink" style={{ width: `${Math.round(sent * 100)}%` }} />
        </div>
      ) : null}
      <p className="text-meta">{detail}</p>
    </div>
  );
}

export function SubtitleImport({
  project,
  replacing,
  onCancel,
  onDone,
}: {
  project: Project;
  replacing?: boolean;
  onCancel?: () => void;
  /** Brouillon reçu : referme l'import quand il remplace un brouillon. */
  onDone?: () => void;
}) {
  const create = useCreateSubtitleDraft();
  const video = useVideoSession();
  const [sent, setSent] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [derja, setDerja] = useState(true);
  const [keyterms, setKeyterms] = useState(() => defaultKeyterms(project));
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<unknown>(null);
  const elapsed = useElapsed(phase === 'processing');

  const send = async () => {
    if (!file) return;
    setError(null);
    try {
      setPhase('extracting');
      const audio = await extractAudioWav(file);
      setPhase('sending');
      setSent(null);
      const characters = [...new Set(project.people.map((p) => p.character).filter((c): c is string => !!c))];
      const input: CreateSubtitleDraftInput = {
        project_id: project.id,
        audio,
        file_name: wavName(file.name),
        language_code: transcriptionLanguage(derja),
        keyterms: keyterms
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean)
          .slice(0, 50),
        characters,
      };
      await create.mutateAsync({
        input,
        onUploadProgress: (done, total) => {
          if (!total) return;
          setSent(done / total);
          // Tout est envoyé : le serveur transcrit puis traduit
          if (done >= total) setPhase('processing');
        },
      });
      // La vidéo reste disponible pour la relecture pendant cette session de l’onglet (jamais envoyée)
      if (file.type.startsWith('video/')) video.setFile(file);
      onDone?.();
    } catch (e) {
      setError(e);
    } finally {
      setPhase('idle');
    }
  };

  const busy = phase !== 'idle';
  const failure = error ? subtitleImportError(error) : null;
  return (
    <section
      aria-labelledby="import-titre"
      className="flex flex-col gap-5 border-2 border-ink bg-white p-5 md:p-6"
    >
      <div className="flex flex-col gap-2">
        <h2 id="import-titre" className="text-h3">
          {replacing
            ? 'Refaire le brouillon depuis ta vidéo'
            : 'Pas encore de sous-titres : importe ta vidéo'}
        </h2>
        <p className="text-muted-on-light">
          Ton navigateur extrait le son, puis l’IA transcrit la derja et propose un brouillon en français et
          en anglais. Tu relis et valides chaque ligne.
          {replacing ? ' Le brouillon actuel sera remplacé.' : ''}
        </p>
      </div>

      <FileDrop
        accept={MEDIA_EXTENSIONS}
        file={file}
        onFile={setFile}
        disabled={busy}
        label="Choisis ta vidéo (ou un fichier audio)"
        hint="MP4, MOV, WebM, MP3, WAV… Le fichier est lu sur ton ordinateur."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Checkbox
          checked={derja}
          onCheckedChange={setDerja}
          disabled={busy}
          label="Le film est en derja (arabe tunisien)"
          hint="Sinon, la langue est détectée automatiquement."
        />
        <Field
          label="Noms à reconnaître"
          hint="Personnages et lieux, séparés par des virgules (50 au plus)."
          optional
        >
          <Input value={keyterms} onChange={(e) => setKeyterms(e.target.value)} disabled={busy} />
        </Field>
      </div>

      <p className="flex items-start gap-2 border-l-4 border-gold bg-gold-soft p-3 text-meta">
        <Icon name="shield" size={18} className="mt-0.5 shrink-0" />
        <span>
          {PRIVACY_MESSAGE}
          {subtitlesSimulated ? ' (Mode démo : rien n’est envoyé, le brouillon d’exemple est utilisé.)' : ''}
        </span>
      </p>

      {failure ? (
        <ErrorState title={failure.title} error={failure.message} onRetry={() => void send()} />
      ) : null}
      {busy ? <ImportProgress phase={phase} sent={sent} elapsed={elapsed} /> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button icon="upload" onClick={() => void send()} disabled={!file || busy} loading={busy}>
          Envoyer le son
        </Button>
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Annuler
          </Button>
        ) : null}
      </div>
    </section>
  );
}
