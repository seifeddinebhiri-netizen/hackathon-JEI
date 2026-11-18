import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { Project, SubtitleLine } from '@/api/types';
import { Button, ButtonLink, ErrorState, Icon, Input, LoadingBlock, useToast } from '@/components/ui';
import { Breadcrumb, WithProject } from '@/features/festival/components/Kit';
import { useSaveSubtitles, useSubtitleDraft } from '@/features/festival/hooks/useFestivals';
import { exportBlocker, lineText, type SrtLang } from '@/features/festival/lib/srt';
import { getSessionVideo, setSessionVideo } from '@/features/festival/lib/videoSession';
import {
  isRisky,
  lineAt,
  lineIndexAt,
  stopReason,
  timed,
  watchStep,
  type TimedLine,
} from '@/features/festival/lib/watch';
import { cn } from '@/lib/cn';

/** Le raccourci clavier ne s'applique pas quand on écrit dans un champ. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

function Kbd({ children }: { children: string }) {
  return <kbd className="border border-current px-1.5 py-0.5 font-mono text-label">{children}</kbd>;
}

function ChooseVideo({ onFile }: { onFile: (f: File) => void }) {
  const id = useId();
  return (
    <section className="flex flex-col items-start gap-4 border-2 border-dashed border-line-dark bg-surface-dark p-6 md:p-10">
      <span className="grid size-12 place-items-center bg-gold text-ink">
        <Icon name="film" size={24} />
      </span>
      <h1 className="text-h3 text-paper">Choisis à nouveau ton fichier vidéo</h1>
      <p className="max-w-prose text-muted-on-dark">
        Ta vidéo est lue par ton navigateur, sur ton ordinateur. Elle n’est jamais envoyée ni enregistrée : il
        faut la choisir à chaque visite.
      </p>
      <label
        htmlFor={id}
        className="inline-flex min-h-11 cursor-pointer items-center gap-2 border-2 border-gold bg-gold px-5 font-semibold text-ink has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-paper"
      >
        <Icon name="upload" size={18} />
        Choisir ma vidéo
        <input
          id={id}
          type="file"
          accept="video/*"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
      </label>
    </section>
  );
}

function Player({
  project,
  lines,
  file,
  onChangeFile,
}: {
  project: Project;
  lines: SubtitleLine[];
  file: File;
  onChangeFile: () => void;
}) {
  const [params, setParams] = useSearchParams();
  const { toast } = useToast();
  const save = useSaveSubtitles(project.id);
  const lang: SrtLang = params.get('langue') === 'fr' ? 'fr' : 'en';
  const video = useRef<HTMLVideoElement>(null);
  const enInput = useRef<HTMLInputElement>(null);
  const tl: TimedLine[] = useMemo(() => timed(lines), [lines]);
  const src = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(src), [src]);

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [idx, setIdx] = useState(() =>
    Math.max(
      0,
      lines.findIndex((l) => l.id === params.get('ligne')),
    ),
  );
  const [stop, setStop] = useState<string | null>(null);
  const segmentStart = useRef(0);
  const acknowledged = useRef(new Set<string>());
  const [validated, setValidated] = useState(
    () => new Set(lines.filter((l) => l.validated).map((l) => l.id)),
  );
  const validatedRef = useRef(validated);
  const [edits, setEdits] = useState<Record<string, { fr?: string; en?: string }>>({});

  // Enregistrement groupé : validations et modifications partent ensemble (1 s après le dernier changement)
  const latest = useRef({ validated, edits, lines, mutate: save.mutate, toast });
  useEffect(() => {
    latest.current = { validated, edits, lines, mutate: save.mutate, toast };
  });
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const scheduleSave = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const { validated: v, edits: e, lines: ls, mutate, toast: t } = latest.current;
      mutate(
        ls.map((l) => ({ ...l, ...e[l.id], validated: v.has(l.id) })),
        {
          onError: () =>
            t({ tone: 'bad', title: 'Validation non enregistrée', description: 'Réessaie dans un instant.' }),
        },
      );
    }, 1000);
  }, []);
  useEffect(() => () => clearTimeout(saveTimer.current), []);

  const markValidated = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;
      const next = new Set(validatedRef.current);
      ids.forEach((id) => next.add(id));
      validatedRef.current = next;
      setValidated(next);
      scheduleSave();
    },
    [scheduleSave],
  );

  // Boucle de lecture : validation des lignes vues, arrêt sur les lignes à risque
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const v = video.current;
      if (!v) return;
      const now = v.currentTime;
      const step = watchStep(tl, segmentStart.current, now, validatedRef.current, acknowledged.current);
      markValidated(step.validate);
      if (step.stop) {
        acknowledged.current.add(step.stop.id);
        v.pause();
        v.currentTime = step.stop.at;
        setIdx(tl.findIndex((l) => l.line.id === step.stop!.id));
        setStop(step.stop.reason);
        setTime(step.stop.at);
        return;
      }
      setTime(now);
      setIdx(lineIndexAt(tl, now));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, tl, markValidated]);

  const play = useCallback(() => {
    const v = video.current;
    if (!v) return;
    segmentStart.current = v.currentTime;
    // Reprendre sur la ligne affichée : elle a déjà été signalée, la lecture ne s'y arrête plus
    const here = lineAt(tl, v.currentTime);
    if (here >= 0) acknowledged.current.add(tl[here].line.id);
    setStop(null);
    void v.play();
  }, [tl]);
  const pause = useCallback(() => video.current?.pause(), []);
  const seekTo = useCallback(
    (i: number) => {
      const v = video.current;
      const target = tl[Math.max(0, Math.min(tl.length - 1, i))];
      if (!v || !target) return;
      v.pause();
      v.currentTime = target.start;
      setTime(target.start);
      setIdx(tl.indexOf(target));
      setStop(
        isRisky(target.line) && !validatedRef.current.has(target.line.id) ? stopReason(target.line) : null,
      );
    },
    [tl],
  );
  const validateAndContinue = useCallback(() => {
    const cur = tl[idx];
    if (!cur) return;
    markValidated([cur.line.id]);
    if (idx < tl.length - 1) {
      seekTo(idx + 1);
      play();
    }
  }, [tl, idx, markValidated, seekTo, play]);
  const replay = useCallback(() => {
    seekTo(idx);
    play();
  }, [idx, seekTo, play]);

  // Position de départ (ligne demandée dans l'URL)
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const onReady = () => {
      if (params.get('ligne')) seekTo(idx);
    };
    v.addEventListener('loadedmetadata', onReady, { once: true });
    return () => v.removeEventListener('loadedmetadata', onReady);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // Raccourcis : Espace, Entrée, E, R, ← → (jamais quand le focus est dans un champ)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.target instanceof HTMLButtonElement && (e.key === ' ' || e.key === 'Enter')) return;
      const actions: Record<string, () => void> = {
        ' ': () => (playing ? pause() : play()),
        enter: validateAndContinue,
        e: () => {
          pause();
          enInput.current?.focus();
        },
        r: replay,
        arrowleft: () => seekTo(idx - 1),
        arrowright: () => seekTo(idx + 1),
      };
      const action = actions[e.key.toLowerCase()];
      if (!action) return;
      e.preventDefault();
      action();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing, play, pause, validateAndContinue, replay, seekTo, idx]);

  const cur = tl[idx]?.line;
  const shownIdx = lineAt(tl, time);
  const shownLine = shownIdx >= 0 ? tl[shownIdx].line : null;
  const textOf = (l: SubtitleLine, lg: SrtLang) => edits[l.id]?.[lg] ?? (lg === 'fr' ? l.fr : (l.en ?? ''));
  const seen = validated.size;
  const allDone = seen === lines.length;
  const merged = lines.map((l) => ({ ...l, ...edits[l.id], validated: validated.has(l.id) }));
  const blocker = exportBlocker(merged, lang);
  const edit = (lg: SrtLang, value: string) => {
    if (!cur) return;
    setEdits((e) => ({ ...e, [cur.id]: { ...e[cur.id], [lg]: value } }));
    scheduleSave();
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
      <section aria-label="Lecteur" className="flex flex-col gap-4 lg:col-span-8">
        <div className="relative bg-ink">
          <video
            ref={video}
            src={src}
            className="aspect-video w-full bg-ink"
            playsInline
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onClick={() => (playing ? pause() : play())}
          />
          <span className="eyebrow absolute top-3 left-3 bg-ink/80 px-2 py-1 text-muted-on-dark">
            {tl[idx]?.line.start ?? '00:00:00,000'}
          </span>
          {!playing && (stop || allDone) ? (
            <span className="eyebrow absolute top-3 right-3 inline-flex items-center gap-1.5 bg-gold px-2 py-1 text-ink">
              <Icon name={allDone ? 'check' : 'alert'} size={14} />
              {allDone ? 'Tout est validé' : 'Arrêt : ligne à vérifier'}
            </span>
          ) : null}
          {shownLine ? (
            <p
              aria-live="off"
              className="absolute inset-x-4 bottom-4 mx-auto w-fit max-w-[90%] bg-ink/85 px-3 py-1.5 text-center text-[18px] leading-snug font-semibold text-white md:text-[22px]"
            >
              {textOf(shownLine, lang)}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="on-dark"
            size="sm"
            icon="chevronLeft"
            aria-label="Ligne précédente"
            onClick={() => seekTo(idx - 1)}
          />
          <Button
            className="bg-gold border-gold text-ink hover:bg-gold-soft hover:border-gold-soft"
            icon={playing ? 'minus' : 'arrowRight'}
            onClick={() => (playing ? pause() : play())}
          >
            {playing ? 'Pause' : allDone ? 'Tout est vu' : 'Lecture'} <Kbd>Espace</Kbd>
          </Button>
          <Button
            variant="on-dark"
            size="sm"
            icon="chevronRight"
            aria-label="Ligne suivante"
            onClick={() => seekTo(idx + 1)}
          />
          <div role="group" aria-label="Langue des sous-titres" className="flex border-2 border-line-dark">
            {(['en', 'fr'] as const).map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={lang === l}
                onClick={() => setParams((p) => (p.set('langue', l), p), { replace: true })}
                className={cn(
                  'min-h-11 px-3 text-meta font-semibold',
                  lang === l ? 'bg-paper text-ink' : 'text-paper hover:bg-surface-dark',
                )}
              >
                {l === 'en' ? 'Anglais' : 'Français'}
              </button>
            ))}
          </div>
          <p className="basis-full text-meta text-muted-on-dark md:basis-auto md:flex-1">
            Les lignes que tu laisses passer sont validées. La lecture s’arrête seule sur les lignes à
            vérifier.
          </p>
        </div>

        <div aria-label="Frise des sous-titres" role="group" className="flex gap-1">
          {tl.map((l, i) => {
            const done = validated.has(l.line.id);
            const risky = isRisky(l.line) && !done;
            return (
              <button
                key={l.line.id}
                type="button"
                onClick={() => seekTo(i)}
                aria-label={`Ligne ${i + 1} · ${l.line.start}${done ? ' · validée' : risky ? ' · arrêt prévu' : ''}`}
                aria-current={i === idx ? 'true' : undefined}
                className={cn(
                  'h-11 min-w-2 flex-1',
                  i === idx ? 'bg-gold' : done ? 'bg-ok-bg' : 'bg-line-dark',
                  risky && i !== idx && 'outline-dashed outline-[3px] -outline-offset-[3px] outline-gold',
                )}
              />
            );
          })}
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-meta text-muted-on-dark">
          <li className="flex items-center gap-2">
            <span className="size-3 bg-ok-bg" aria-hidden />
            Vue et validée
          </li>
          <li className="flex items-center gap-2">
            <span className="size-3 bg-line-dark" aria-hidden />
            Pas encore vue
          </li>
          <li className="flex items-center gap-2">
            <span
              className="size-3 bg-line-dark outline-dashed outline-2 -outline-offset-2 outline-gold"
              aria-hidden
            />
            Arrêt prévu
          </li>
          <li className="flex items-center gap-2">
            <span className="size-3 bg-gold" aria-hidden />
            Ligne en cours
          </li>
        </ul>
        <p className="text-meta text-muted-on-dark" aria-live="polite">
          {seen} / {lines.length} lignes validées ·{' '}
          {blocker ? blocker : 'Export du .srt possible depuis la relecture.'}{' '}
          <button
            type="button"
            onClick={onChangeFile}
            className="min-h-11 underline underline-offset-4 hover:text-gold"
          >
            Changer de vidéo
          </button>
        </p>
      </section>

      {cur ? (
        <aside
          aria-label="Ligne en cours"
          className="flex flex-col gap-4 border-2 border-line-dark bg-surface-dark p-5 lg:col-span-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-label text-muted-on-dark">
              {cur.start} → {cur.end}
            </span>
            {cur.speaker ? <span className="eyebrow text-muted-on-dark">Locuteur {cur.speaker}</span> : null}
          </div>
          {stop && !validated.has(cur.id) ? (
            <p className="flex items-start gap-2 border-2 border-gold p-3 text-meta text-gold">
              <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
              {stop}
            </p>
          ) : validated.has(cur.id) ? (
            <p className="flex items-center gap-2 text-meta text-ok-bg">
              <Icon name="check" size={16} /> Validée
            </p>
          ) : null}
          <div>
            <p className="eyebrow text-muted-on-dark">Ce qui est dit</p>
            <p className="font-semibold" lang="aeb-Latn">
              {cur.source}
            </p>
          </div>
          {(['en', 'fr'] as const).map((lg) => (
            <label key={lg} className="flex flex-col gap-1.5 text-meta font-semibold">
              {lg === 'en' ? 'Anglais' : 'Français'}
              <Input
                ref={lg === 'en' ? enInput : undefined}
                lang={lg}
                value={textOf(cur, lg)}
                onFocus={pause}
                onChange={(e) => edit(lg, e.target.value)}
                className="border-line-dark"
              />
            </label>
          ))}
          {cur.note ? (
            <p className="border-l-4 border-gold pl-3 text-meta text-muted-on-dark">
              <strong className="text-paper">Glossaire : </strong>
              {cur.note}
            </p>
          ) : null}
          <div className="flex flex-col gap-2">
            <Button onClick={validateAndContinue} icon="check">
              Valider et continuer <Kbd>Entrée</Kbd>
            </Button>
            <Button variant="on-dark" onClick={replay}>
              Revoir · R
            </Button>
          </div>
          <p className="text-meta text-muted-on-dark">
            Raccourcis : Espace lecture · Entrée valider · E modifier · R revoir · ← → ligne. Inactifs quand
            tu écris dans un champ.
          </p>
          {lineText({ ...cur, ...edits[cur.id] }, lang) ? null : (
            <p className="text-meta text-gold">
              Cette ligne n’a pas de texte {lang === 'en' ? 'anglais' : 'français'}.
            </p>
          )}
        </aside>
      ) : null}
    </div>
  );
}

function Page({ project }: { project: Project }) {
  const draft = useSubtitleDraft(project.id);
  const [file, setFile] = useState<File | null>(() => getSessionVideo());
  const choose = (f: File | null) => {
    setSessionVideo(f);
    setFile(f);
  };
  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb
        dark
        items={[
          { label: 'Mes dossiers', to: '/festival/dossiers' },
          { label: 'Sous-titres', to: '/festival/sous-titres' },
          { label: 'Regarder et valider' },
        ]}
      />
      {draft.isPending ? (
        <LoadingBlock lines={6} label="Chargement des sous-titres…" />
      ) : draft.isError ? (
        <ErrorState
          error={draft.error}
          onRetry={() => void draft.refetch()}
          title="Les sous-titres n’ont pas pu être chargés"
        />
      ) : !draft.data.lines.length ? (
        <section className="flex flex-col items-start gap-4 border-2 border-dashed border-line-dark p-6">
          <h1 className="text-h3">Pas encore de sous-titres</h1>
          <p className="text-muted-on-dark">Importe d’abord le son de ton film depuis la relecture.</p>
          <ButtonLink to="/festival/sous-titres" variant="on-dark">
            Aller à la relecture
          </ButtonLink>
        </section>
      ) : !file ? (
        <ChooseVideo onFile={choose} />
      ) : (
        <Player
          key={file.name + file.size}
          project={project}
          lines={draft.data.lines}
          file={file}
          onChangeFile={() => choose(null)}
        />
      )}
    </div>
  );
}

export default function Regarder() {
  return (
    <div className="-mx-4 -my-8 min-h-[calc(100dvh-4rem)] bg-ink px-4 py-8 text-paper md:-mx-12 md:-my-12 md:px-12 md:py-12 xl:-mx-16 xl:px-16">
      <WithProject dark>{(project) => <Page project={project} />}</WithProject>
    </div>
  );
}
