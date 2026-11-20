import { useEffect, useRef, useState } from 'react';
import type { SceneProps } from '@/data/deck';
import { useBeatTimeline } from '@/hooks/useBeatTimeline';
import { useKeyCapture } from '@/hooks/keyCapture';
import { asset, cx, Eyebrow, Logo } from '@/components/ui';

/**
 * SÉQUENCE 04 — Salle de projection. Trois façons de montrer le prototype :
 *  A. en direct : l'application tourne dans l'écran géant (iframe), ou dans un onglet ;
 *  B. vidéo de secours : public/video/demo.mp4 (à déposer) ;
 *  C. parcours en captures réelles : toujours disponible, hors connexion.
 * Rien n'est simulé : en C, chaque image est une capture du prototype en mode démonstration.
 */
const APP_KEY = 'encadre-prise02-app';
const DEFAULT_APP = 'http://localhost:5173/projet';

function appUrl(): string {
  const q = new URLSearchParams(window.location.search).get('app');
  if (q) {
    try {
      localStorage.setItem(APP_KEY, q);
    } catch {
      /* stockage indisponible */
    }
    return q;
  }
  try {
    return localStorage.getItem(APP_KEY) || DEFAULT_APP;
  } catch {
    return DEFAULT_APP;
  }
}

const STEPS = [
  { src: 'captures/accueil.png', t: 'Ouvrir Encadré', d: 'L’accueil : quatre étapes, du scénario au festival.' },
  { src: 'captures/projet.png', t: 'Le projet « Dar Hmeti »', d: 'Tableau de bord : où en est le film, ce qu’il reste à faire.' },
  { src: 'captures/parcours-1-import.png', t: 'Importer un scénario', d: 'Fichier ou texte collé ; un simple récit suffit.' },
  { src: 'captures/parcours-3-decoupage.png', t: 'Le découpage proposé', d: 'Scènes, lieux, personnages : chaque scène est un brouillon à relire.' },
  { src: 'captures/parcours-4-suggestions.png', t: 'Les suggestions de l’IA', d: 'Chacune cite le texte qui la justifie. Accepter ou refuser.' },
  { src: 'captures/parcours-5-suggestion-acceptee.png', t: 'La décision du cinéaste', d: 'Une suggestion acceptée modifie le brouillon, pas l’histoire.' },
  { src: 'captures/parcours-7-lieux-proposes.png', t: 'Des lieux réels', d: 'Types de lieux par l’IA, adresses par OpenStreetMap, à vérifier sur place.' },
  { src: 'captures/parcours-8-garde-fou.png', t: 'Un garde-fou', d: 'Des scènes ne sont pas relues : l’application le signale avant de générer.' },
  { src: 'captures/calendrier-long.png', t: 'Le calendrier', d: 'Brouillon de planning, conflits à régler, puis « Valider le planning ».' },
  { src: 'captures/feuille-de-service-long.png', t: 'La feuille de service', d: 'Le résultat imprimable pour l’équipe, jour par jour.' },
];

type Mode = null | 'live' | 'video' | 'captures';

export function Demo({ beat }: SceneProps) {
  const ref = useRef<HTMLElement>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [full, setFull] = useState(false);
  const [step, setStep] = useState(0);
  const [live, setLive] = useState<'checking' | 'ok' | 'down'>('checking');
  const [video, setVideo] = useState<'checking' | 'ok' | 'missing'>('checking');
  const [url] = useState(appUrl);

  useBeatTimeline(ref, beat, (tl) => {
    tl.from('.beam', { opacity: 0, duration: 0.9, ease: 'power2.out' }, 0.3)
      .from('.screen', { opacity: 0.2, duration: 0.6 }, 0.3)
      .from('.seats', { y: 80, duration: 0.8 }, 0)
      .from('.title-card > *', { opacity: 0, y: 24, duration: 0.5, stagger: 0.1 }, 0.8)
      .addLabel('b0');
  });

  // Disponibilité de l'application et de la vidéo
  useEffect(() => {
    let alive = true;
    fetch(url, { mode: 'no-cors' })
      .then(() => alive && setLive('ok'))
      .catch(() => alive && setLive('down'));
    fetch(asset('video/demo.mp4'), { method: 'HEAD' })
      .then((r) => alive && setVideo(r.ok && (r.headers.get('content-type') ?? '').startsWith('video') ? 'ok' : 'missing'))
      .catch(() => alive && setVideo('missing'));
    return () => {
      alive = false;
    };
  }, [url]);

  useKeyCapture((e) => {
    if (!mode) return false;
    if (e.key === 'Escape') {
      if (full) setFull(false);
      else setMode(null);
      return true;
    }
    if (mode === 'captures') {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') setStep((s) => Math.min(STEPS.length - 1, s + 1));
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') setStep((s) => Math.max(0, s - 1));
      else return false;
      return true;
    }
    // Direct ou vidéo : on garde la main sur la démonstration
    return ['ArrowRight', 'ArrowLeft', ' ', 'PageDown', 'PageUp'].includes(e.key);
  });

  const open = (m: Mode) => {
    setMode(m);
    setStep(0);
    setFull(false);
  };
  const s = STEPS[step];

  const screenContent = (
    <>
      {mode === null ? (
        <div className="title-card flex h-full flex-col items-center justify-center gap-8 text-center">
          <Logo style={{ width: 420 }} />
          <p className="display text-[72px] text-paper">Place à la démonstration</p>
          <div className="flex gap-6">
            <ModeButton k="A" label="Démo en direct" note={live === 'ok' ? 'Application joignable' : live === 'down' ? 'Application non lancée' : 'Vérification…'} ok={live === 'ok'} onClick={() => open('live')} />
            <ModeButton k="B" label="Vidéo de secours" note={video === 'ok' ? 'demo.mp4 prête' : video === 'missing' ? 'Vidéo à déposer' : 'Vérification…'} ok={video === 'ok'} onClick={() => open('video')} />
            <ModeButton k="C" label="Parcours en captures" note="Toujours disponible" ok onClick={() => open('captures')} />
          </div>
        </div>
      ) : null}

      {mode === 'live' ? (
        live === 'down' ? (
          <Notice title="L’application ne répond pas" lines={[`Adresse : ${url}`, 'Lancer : cd web && npm run dev (mode démo par défaut)', 'Autre adresse : ajouter ?app=https://… à l’URL de la présentation', 'Ou passer à B (vidéo) ou C (captures).']} />
        ) : (
          <iframe title="Encadré en direct" src={url} className="h-full w-full border-0 bg-paper" allow="camera; microphone; fullscreen; clipboard-write" />
        )
      ) : null}

      {mode === 'video' ? (
        video === 'ok' ? (
          <video src={asset('video/demo.mp4')} controls autoPlay className="h-full w-full bg-black" />
        ) : (
          <Notice title="Vidéo de secours à déposer" lines={['Enregistrer le parcours, puis copier le fichier ici :', 'presentation-encadre/public/video/demo.mp4', 'Elle sera alors lue directement dans cet écran, hors connexion.', 'En attendant : C, le parcours en captures réelles.']} />
        )
      ) : null}

      {mode === 'captures' ? (
        <div className="relative h-full w-full bg-paper">
          <img key={s.src} src={asset(s.src)} alt={s.t} className="cap-img h-full w-full object-cover object-top" draggable={false} />
          <div className="absolute right-0 bottom-0 left-0 flex items-end justify-between gap-6 bg-ink/92 px-8 py-5">
            <div>
              <p className="eyebrow text-[17px] text-gold">
                Étape {step + 1} / {STEPS.length}
              </p>
              <p className="display text-[40px] text-paper">{s.t}</p>
              <p className="text-[22px] text-muted-on-dark">{s.d}</p>
            </div>
            <div className="flex shrink-0 gap-3">
              <button type="button" className="ctrl cursor-pointer border-2 border-paper bg-transparent px-5 text-[26px] text-paper disabled:opacity-30" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} aria-label="Étape précédente">
                ‹
              </button>
              <button type="button" className="ctrl cursor-pointer border-2 border-gold bg-gold px-5 text-[26px] text-ink disabled:opacity-30" onClick={() => setStep(Math.min(STEPS.length - 1, step + 1))} disabled={step === STEPS.length - 1} aria-label="Étape suivante">
                ›
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );

  return (
    <section ref={ref} className="absolute inset-0 overflow-hidden bg-[#070707]" aria-label="Place à la démonstration">
      {/* Faisceau du projecteur */}
      <div aria-hidden className="beam absolute" style={{ left: 260, top: 60, width: 1400, height: 1100, background: 'linear-gradient(0deg, rgba(255,231,163,.18), rgba(255,231,163,.03) 70%)', clipPath: 'polygon(0 0, 100% 0, 54% 100%, 46% 100%)' }} />

      {/* Écran géant */}
      <div className={cx('screen absolute overflow-hidden border-[6px] border-[#2a2826] bg-ink', full ? 'z-40' : '')} style={full ? { left: 0, top: 0, width: 1920, height: 1080, border: 0 } : { left: 260, top: 50, width: 1400, height: 788, boxShadow: '0 0 120px rgba(255,231,163,.18)' }}>
        {screenContent}
        {mode ? (
          <div className="absolute top-3 right-3 z-10 flex gap-2">
            {mode === 'live' && live !== 'down' ? (
              <a href={url} target="_blank" rel="noreferrer" className="ctrl eyebrow flex items-center border-2 border-ink bg-paper px-3 text-[14px] text-ink no-underline">
                Ouvrir dans un onglet ↗
              </a>
            ) : null}
            {mode !== 'captures' ? (
              <button type="button" onClick={() => setFull(!full)} className="ctrl eyebrow cursor-pointer border-2 border-ink bg-paper px-3 text-[14px] text-ink">
                {full ? 'Réduire' : 'Plein écran'}
              </button>
            ) : null}
            <button type="button" onClick={() => (full ? setFull(false) : setMode(null))} className="ctrl eyebrow cursor-pointer border-2 border-gold bg-gold px-3 text-[14px] text-ink">
              ← Revenir à la présentation (Échap)
            </button>
          </div>
        ) : null}
      </div>

      {/* Fauteuils */}
      <div aria-hidden className="seats absolute right-0 bottom-0 left-0 h-[200px]">
        {[0, 1].map((row) => (
          <div key={row} className="absolute flex gap-3" style={{ bottom: row === 0 ? 60 : -10, left: row === 0 ? 300 : 250 }}>
            {Array.from({ length: row === 0 ? 17 : 18 }).map((_, i) => (
              <span key={i} className="block bg-[#141312]" style={{ width: 70, height: row === 0 ? 70 : 90, borderRadius: '18px 18px 4px 4px', border: '2px solid #1f1d1b' }} />
            ))}
          </div>
        ))}
      </div>

      <div className="absolute top-[862px] left-[300px]">
        <Eyebrow color="text-gold" className="text-[18px]">
          Séquence 04 · Place à la démonstration
        </Eyebrow>
      </div>
      <p className="absolute top-[862px] right-[260px] text-[18px] text-muted-on-dark">Mode démonstration : données simulées « Dar Hmeti », identifiées dans l’application</p>
    </section>
  );
}

function ModeButton({ k, label, note, ok, onClick }: { k: string; label: string; note: string; ok: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="ctrl flex w-[330px] cursor-pointer flex-col items-start gap-1 border-[3px] border-paper bg-transparent px-6 py-5 text-left text-paper hover:bg-paper hover:text-ink">
      <span className="eyebrow text-[18px] text-gold">{k}</span>
      <span className="display text-[34px]">{label}</span>
      <span className={cx('text-[18px]', ok ? 'text-ok-bright' : 'text-muted-on-dark')}>{ok ? '● ' : '○ '}{note}</span>
    </button>
  );
}

function Notice({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-16 text-center">
      <p className="display text-[52px] text-gold">{title}</p>
      {lines.map((l) => (
        <p key={l} className="text-[26px] text-paper">
          {l}
        </p>
      ))}
    </div>
  );
}
