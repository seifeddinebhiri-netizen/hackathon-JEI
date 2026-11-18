import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { Project, SubtitleDraft } from '@/api/types';
import { AiDraftBadge, Button, Icon, SegmentedControl, useToast } from '@/components/ui';
import { useSaveSubtitles } from '../../hooks/useFestivals';
import { downloadSrt, exportBlocker, srtFileName, type SrtLang } from '../../lib/srt';
import {
  checkSummary,
  initialFilter,
  mergeLine,
  needsCheck,
  nextIndex,
  previousIndex,
  subtitleText,
  visibleIndexes,
  type LineEdit,
  type LineEdits,
  type ViewerFilter,
} from '../../lib/viewer';
import { lineAt, lineIndexAt, timed, watchStep } from '../../lib/watch';
import { useVideoSession } from '../../video/videoSession';
import { SubtitleImport } from '../SubtitleImport';
import { AiDetails } from './AiDetails';
import { Kbd, LinePanel } from './LinePanel';
import { Timeline } from './Timeline';
import { ChooseVideo, VideoFrame } from './VideoFrame';

/** Le raccourci clavier ne s'applique pas quand on écrit dans un champ. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * Écran unique de relecture : en-tête (progression, langue, export), lecteur + ligne en cours,
 * frise, puis « Ce que l'IA a fait ». Avec la vidéo, les lignes vues en entier sont validées et la
 * lecture s'arrête sur les lignes à risque ; sans vidéo, on relit ligne par ligne sur le même cadre.
 */
export function SubtitleViewer({
  project,
  draft,
  festivalLabel,
}: {
  project: Project;
  draft: SubtitleDraft;
  festivalLabel?: string;
}) {
  const [params, setParams] = useSearchParams();
  const { toast } = useToast();
  const save = useSaveSubtitles(project.id);
  const { url, setFile } = useVideoSession();
  const lang: SrtLang = params.get('langue') === 'fr' ? 'fr' : 'en';
  const lines = draft.lines;
  const tl = useMemo(() => timed(lines), [lines]);
  const video = useRef<HTMLVideoElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const director = project.people.find((p) => /réalisation/i.test(p.role))?.name ?? 'toi';

  const [replacing, setReplacing] = useState(false);
  const [filter, setFilter] = useState<ViewerFilter>(() => initialFilter(lines));
  const [validated, setValidated] = useState(
    () => new Set(lines.filter((l) => l.validated).map((l) => l.id)),
  );
  const validatedRef = useRef(validated);
  const [edits, setEdits] = useState<LineEdits>({});
  const [idx, setIdx] = useState(() => {
    const asked = lines.findIndex((l) => l.id === params.get('ligne'));
    if (asked >= 0) return asked;
    return visibleIndexes(lines, initialFilter(lines), validated)[0] ?? 0;
  });
  const idxRef = useRef(idx);
  useEffect(() => {
    idxRef.current = idx;
  }, [idx]);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(() => tl[idx]?.start ?? 0);
  const segmentStart = useRef(0);
  const acknowledged = useRef(new Set<string>());

  const merged = useMemo(() => lines.map((l) => mergeLine(l, edits, validated)), [lines, edits, validated]);
  const visible = useMemo(() => visibleIndexes(lines, filter, validated), [lines, filter, validated]);
  const riskyCount = useMemo(() => lines.filter((l) => needsCheck(l, validated)).length, [lines, validated]);

  // Enregistrement groupé : validations et modifications partent ensemble, 1 s après le dernier changement
  const latest = useRef({ merged, mutate: save.mutate, toast });
  useEffect(() => {
    latest.current = { merged, mutate: save.mutate, toast };
  });
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const scheduleSave = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const { merged: ls, mutate, toast: t } = latest.current;
      mutate(ls, {
        onError: () =>
          t({ tone: 'bad', title: 'Relecture non enregistrée', description: 'Réessaie dans un instant.' }),
      });
    }, 1000);
  }, []);
  useEffect(() => () => clearTimeout(saveTimer.current), []);

  const setValidatedIds = useCallback(
    (update: (s: Set<string>) => void) => {
      const next = new Set(validatedRef.current);
      update(next);
      validatedRef.current = next;
      setValidated(next);
      scheduleSave();
    },
    [scheduleSave],
  );
  const markValidated = useCallback(
    (ids: string[]) => {
      if (ids.length) setValidatedIds((s) => ids.forEach((id) => s.add(id)));
    },
    [setValidatedIds],
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
    // Reprendre sur la ligne affichée : elle a déjà été vue, la lecture ne s'y arrête plus
    const here = lineAt(tl, v.currentTime);
    if (here >= 0) acknowledged.current.add(tl[here].line.id);
    void v.play();
  }, [tl]);
  const pause = useCallback(() => video.current?.pause(), []);
  const toggle = useCallback(() => (playing ? pause() : play()), [playing, pause, play]);

  const seekTo = useCallback(
    (i: number) => {
      const target = tl[Math.max(0, Math.min(tl.length - 1, i))];
      if (!target) return;
      const v = video.current;
      if (v) {
        v.pause();
        v.currentTime = target.start;
      }
      setTime(target.start);
      setIdx(tl.indexOf(target));
    },
    [tl],
  );

  // Nouvelle vidéo : se placer sur la ligne en cours dès que la durée est connue
  useEffect(() => {
    const v = video.current;
    if (!v || !url) return;
    const onReady = () => {
      const t = tl[idxRef.current]?.start ?? 0;
      v.currentTime = t;
      setTime(t);
    };
    v.addEventListener('loadedmetadata', onReady, { once: true });
    return () => v.removeEventListener('loadedmetadata', onReady);
  }, [url, tl]);

  const goNext = useCallback(() => {
    const n = nextIndex(visible, idx);
    if (n !== null) return seekTo(n);
    if (idx < lines.length - 1) seekTo(idx + 1);
  }, [visible, idx, lines.length, seekTo]);
  const goPrevious = useCallback(() => {
    const p = previousIndex(visible, idx);
    seekTo(p ?? idx - 1);
  }, [visible, idx, seekTo]);

  const validateAndContinue = useCallback(() => {
    const cur = lines[idx];
    if (!cur) return;
    markValidated([cur.id]);
    const after = new Set(validatedRef.current);
    let n = nextIndex(visibleIndexes(lines, filter, after), idx);
    if (n === null && filter === 'risque') {
      // Plus de ligne à risque après celle-ci : on relit le reste dans l'ordre du film
      const left = lines.findIndex((l) => !after.has(l.id));
      if (left >= 0) {
        setFilter('toutes');
        n = left;
      }
    }
    if (n === null) return;
    seekTo(n);
    if (url) play();
  }, [lines, idx, filter, markValidated, seekTo, url, play]);

  const replay = useCallback(() => {
    if (!url) return;
    seekTo(idx);
    play();
  }, [url, idx, seekTo, play]);

  // Raccourcis : Espace, Entrée, E, R, ← → (jamais quand le focus est dans un champ)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (replacing || isTyping(e.target) || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.target instanceof HTMLElement && e.target.closest('button, a, summary, label')) {
        if (e.key === ' ' || e.key === 'Enter') return;
      }
      const actions: Record<string, () => void> = {
        enter: validateAndContinue,
        e: () => {
          pause();
          field.current?.focus();
        },
        arrowleft: goPrevious,
        arrowright: goNext,
        ...(url ? { ' ': toggle, r: replay } : {}),
      };
      const action = actions[e.key.toLowerCase()];
      if (!action) return;
      e.preventDefault();
      action();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [replacing, url, toggle, pause, validateAndContinue, replay, goNext, goPrevious]);

  const editLine = (patch: LineEdit) => {
    const cur = lines[idx];
    if (!cur) return;
    setEdits((e) => ({ ...e, [cur.id]: { ...e[cur.id], ...patch } }));
    scheduleSave();
  };

  if (replacing)
    return (
      <SubtitleImport
        project={project}
        replacing
        onCancel={() => setReplacing(false)}
        onDone={() => setReplacing(false)}
      />
    );

  const cur = merged[idx];
  const done = validated.size;
  const allDone = done === lines.length;
  const blocker = exportBlocker(merged, lang);
  const reason = cur && needsCheck(cur, validated) ? checkSummary(cur) : null;
  // Sous-titre incrusté : avec la vidéo, celui de l'instant ; sans vidéo, celui de la ligne en cours
  const shown = url ? lineAt(tl, time) : idx;
  const overlay = shown >= 0 && lines[shown] ? subtitleText(lines[shown], lang, edits) : '';
  const badge =
    !playing && (allDone || (url && reason)) ? (
      <span className="eyebrow inline-flex items-center gap-1.5 bg-gold px-2 py-1 text-ink">
        <Icon name={allDone ? 'check' : 'alert'} size={14} />
        {allDone ? (
          'Tout est validé'
        ) : (
          <>
            <span className="md:hidden">À vérifier</span>
            <span className="hidden md:inline">Arrêt : ligne à vérifier</span>
          </>
        )}
      </span>
    ) : null;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 border-2 border-ink bg-white p-4 md:p-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[26px] leading-tight md:text-h2">
              {project.title} · {draft.source_lang} → anglais, français
            </h1>
            <AiDraftBadge validated={allDone} />
          </div>
          <p aria-live="polite">
            <strong>
              {done} / {lines.length} lignes validées
            </strong>
            {allDone ? ' · tout est relu.' : ' · regarde et valide chaque ligne.'}
          </p>
          <div
            role="progressbar"
            aria-label="Lignes validées"
            aria-valuemin={0}
            aria-valuemax={lines.length}
            aria-valuenow={done}
            className="h-2.5 w-full max-w-md bg-line-light"
          >
            <div className="h-full bg-ink" style={{ width: `${Math.round((done / lines.length) * 100)}%` }} />
          </div>
        </div>
        <div className="flex flex-col gap-2 lg:items-end">
          <div className="flex flex-wrap items-end gap-3">
            <SegmentedControl
              legend={<span className="sr-only">Langue des sous-titres</span>}
              value={lang}
              onChange={(v) => setParams((p) => (p.set('langue', v), p), { replace: true })}
              options={[
                { value: 'en', label: 'Anglais' },
                { value: 'fr', label: 'Français' },
              ]}
            />
            <Button
              icon={blocker ? 'lock' : 'download'}
              disabled={!!blocker}
              aria-describedby="export-note"
              onClick={() => downloadSrt(merged, lang, project.title)}
            >
              Exporter le .srt
            </Button>
          </div>
          <p id="export-note" className="text-meta text-muted-on-light">
            {blocker ?? `Toutes les lignes sont validées : ${srtFileName(project.title, lang)} est prêt.`}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        <section aria-label="Lecteur" className="flex min-w-0 flex-col gap-3 lg:col-span-8">
          <VideoFrame
            url={url}
            videoRef={video}
            text={overlay}
            lang={lang}
            timecode={lines[idx]?.start ?? '00:00:00,000'}
            badge={badge}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onToggle={toggle}
            onChooseFile={setFile}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              icon="chevronLeft"
              aria-label="Ligne précédente"
              onClick={goPrevious}
            />
            {url ? (
              <Button variant="secondary" icon={playing ? 'minus' : 'arrowRight'} onClick={toggle}>
                {playing ? 'Pause' : 'Lecture'} <Kbd>Espace</Kbd>
              </Button>
            ) : (
              <span className="font-mono text-label text-muted-on-light">
                Ligne {idx + 1} / {lines.length}
              </span>
            )}
            <Button
              variant="secondary"
              size="sm"
              icon="chevronRight"
              aria-label="Ligne suivante"
              onClick={goNext}
            />
            {url ? (
              <ChooseVideo
                onFile={setFile}
                label="Changer de vidéo"
                className="text-meta underline underline-offset-4"
              />
            ) : null}
          </div>
          <p className="text-meta text-muted-on-light">
            {url
              ? 'Les lignes que tu laisses passer sont validées. La lecture s’arrête seule sur les lignes à vérifier. Ta vidéo est lue sur ton ordinateur, jamais envoyée.'
              : 'Sans vidéo, tu relis ligne par ligne. Choisis ta vidéo pour voir chaque sous-titre sur l’image : elle est lue sur ton ordinateur, jamais envoyée.'}
          </p>
        </section>

        {cur ? (
          <LinePanel
            key={cur.id}
            line={cur}
            lang={lang}
            reason={reason}
            hasVideo={!!url}
            isLast={idx === lines.length - 1}
            inputRef={field}
            onEdit={(lg, value) => editLine({ [lg]: value })}
            onUseShort={(lg) => {
              const short = lg === 'fr' ? cur.fr_court : cur.en_court;
              editLine(lg === 'fr' ? { fr: short, fr_court: undefined } : { en: short, en_court: undefined });
            }}
            onDismissShort={(lg) => editLine(lg === 'fr' ? { fr_court: undefined } : { en_court: undefined })}
            onFocusField={pause}
            onValidate={validateAndContinue}
            onReplay={replay}
            onUnvalidate={() => setValidatedIds((s) => s.delete(cur.id))}
          />
        ) : null}
      </div>

      <Timeline
        lines={merged}
        visible={visible}
        current={idx}
        validated={validated}
        filter={filter}
        riskyCount={riskyCount}
        onFilter={setFilter}
        onSelect={seekTo}
      />

      <AiDetails
        draft={draft}
        director={director}
        festivalLabel={festivalLabel}
        onReplace={() => {
          pause();
          setReplacing(true);
        }}
      />
    </div>
  );
}
