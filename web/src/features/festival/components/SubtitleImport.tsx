import { useState } from 'react';
import type { CreateSubtitleDraftInput, Project } from '@/api/types';
import { mockFallback, usingMocks, realEndpointsInMockMode } from '@/api';
import { Button, Checkbox, ErrorState, Field, FileDrop, Icon, Input, Spinner } from '@/components/ui';
import { useCreateSubtitleDraft, useExampleSubtitleDraft } from '../hooks/useFestivals';
import { AudioExtractError, extractAudioWav, transcriptionLanguage, wavName } from '../lib/audio';
import { useVideoSession } from '../video/videoSession';

const MEDIA_EXTENSIONS = ['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.mp3', '.wav', '.m4a', '.aac', '.ogg'];
const PRIVACY_MESSAGE =
  'Seul le son de ton film est envoyé pour la transcription (ElevenLabs), puis traduit (Gemini, version de test). Ta vidéo reste sur ton ordinateur.';

type Phase = 'idle' | 'extracting' | 'sending';

function defaultKeyterms(project: Project): string {
  const names = new Set<string>();
  for (const p of project.people) if (p.character) names.add(p.character);
  return [...names].join(', ');
}

/** Import : la vidéo est lue par le navigateur, seul un WAV mono 16 kHz part au serveur. */
export function SubtitleImport({
  project,
  replacing,
  onCancel,
  onDone,
}: {
  project: Project;
  replacing?: boolean;
  onCancel?: () => void;
  /** Brouillon reçu (réel ou d'exemple) : referme l'import quand il remplace un brouillon. */
  onDone?: () => void;
}) {
  const create = useCreateSubtitleDraft();
  const video = useVideoSession();
  const example = useExampleSubtitleDraft();
  const [lastInput, setLastInput] = useState<CreateSubtitleDraftInput | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [derja, setDerja] = useState(true);
  const [keyterms, setKeyterms] = useState(() => defaultKeyterms(project));
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<unknown>(null);
  const simulated = usingMocks && !realEndpointsInMockMode.includes('createSubtitleDraft');

  const send = async () => {
    if (!file) return;
    setError(null);
    try {
      setPhase('extracting');
      const audio = await extractAudioWav(file);
      setPhase('sending');
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
      setLastInput(input);
      await create.mutateAsync(input);
      // La vidéo reste disponible pour la relecture pendant cette session de l’onglet (jamais envoyée)
      if (file.type.startsWith('video/')) video.setFile(file);
      onDone?.();
    } catch (e) {
      setError(e);
    } finally {
      setPhase('idle');
    }
  };

  const openExample = async () => {
    if (!lastInput) return;
    setError(null);
    try {
      await example.mutateAsync(lastInput);
      onDone?.();
    } catch (e) {
      setError(e);
    }
  };

  const busy = phase !== 'idle' || example.isPending;
  // Le vrai service a échoué (pas l'extraction du son) : en mode mixte, le mock reste un repli.
  const canUseExample =
    !!error && !(error instanceof AudioExtractError) && !simulated && !!mockFallback && !!lastInput;
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
          {simulated ? ' (Démo : rien n’est envoyé, le brouillon d’exemple est utilisé.)' : ''}
        </span>
      </p>

      {error ? (
        <ErrorState
          title={
            error instanceof AudioExtractError
              ? 'Le son n’a pas pu être extrait'
              : 'Le brouillon n’a pas pu être créé'
          }
          error={error}
          onRetry={() => void send()}
        />
      ) : null}
      {canUseExample ? (
        <div className="flex flex-col items-start gap-2 border-l-4 border-gold bg-gold-soft p-3">
          <p className="text-meta">
            Le service réel n’a pas abouti. Pour continuer la démo, tu peux ouvrir le brouillon d’exemple : ce
            n’est pas la transcription de ta vidéo.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void openExample()}
            loading={example.isPending}
          >
            Continuer avec le brouillon d’exemple
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button icon="upload" onClick={() => void send()} disabled={!file || busy} loading={busy}>
          Envoyer le son
        </Button>
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Annuler
          </Button>
        ) : null}
        {busy ? (
          <p role="status" className="flex items-center gap-2 text-meta">
            <Spinner />
            {phase === 'extracting'
              ? 'Extraction du son dans ton navigateur…'
              : 'Transcription et traduction en cours : cela peut prendre une à plusieurs minutes.'}
          </p>
        ) : null}
      </div>
    </section>
  );
}
