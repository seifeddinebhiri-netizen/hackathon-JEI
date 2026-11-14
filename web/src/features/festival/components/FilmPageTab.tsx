import { Link } from 'react-router';
import type { Project } from '@/api/types';
import { Button, Checkbox, Field, Icon, Input, PhotoFrame, useToast } from '@/components/ui';
import { useProjectPassport } from '@/features/passport/hooks/usePassport';
import { cn } from '@/lib/cn';
import { env } from '@/lib/env';
import { PHOTOS } from '@/lib/photos';
import { copyToClipboard } from '@/lib/print';
import { EMPTY_FILM_PAGE, EMPTY_SYNOPSIS, projectField, useProjectField } from '../lib/localStore';

function Check({ ok, label, to }: { ok: boolean; label: string; to?: string }) {
  return (
    <li className="flex min-h-11 items-center justify-between gap-2 border-b border-line-light">
      <span className="flex items-center gap-2">
        <span
          className={cn(
            'grid size-6 place-items-center border-2',
            ok ? 'border-ok-fg bg-ok-bg text-ok-fg' : 'border-warn-fg bg-warn-bg text-warn-fg',
          )}
        >
          <Icon name={ok ? 'check' : 'minus'} size={14} />
        </span>
        {label}
        <span className="sr-only">{ok ? ' : prêt' : ' : à compléter'}</span>
      </span>
      {!ok && to ? (
        <Link
          to={to}
          className="inline-flex min-h-11 items-center text-meta font-semibold underline underline-offset-4"
        >
          Compléter
        </Link>
      ) : null}
    </li>
  );
}

export function FilmPageTab({ project }: { project: Project }) {
  const [page, setPage, saveState] = useProjectField(project, 'film_page', EMPTY_FILM_PAGE);
  const synopsis = projectField(project, 'synopsis', EMPTY_SYNOPSIS);
  const passport = useProjectPassport(project.id);
  const { toast } = useToast();
  const url = `${env.publicAppUrl.replace(/\/$/, '')}/film/${project.id}`;
  const trailerOk = !page.trailer_url || /^https?:\/\/\S+$/.test(page.trailer_url);
  const credits = project.people.filter((p) => p.name.trim()).length;
  const toggle = (src: string, on: boolean) =>
    setPage((p) => ({ ...p, stills: on ? [...p.stills, src] : p.stills.filter((s) => s !== src) }));

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
      <div className="flex flex-col gap-6 lg:col-span-7">
        <section aria-labelledby="pf-photos" className="flex flex-col gap-3">
          <h2 id="pf-photos" className="text-h3">
            Photos du film
          </h2>
          <p className="text-meta text-muted-on-light">
            Choisis les images affichées sur la page. Démo : photos d’illustration créditées.
          </p>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {Object.values(PHOTOS).map((ph) => {
              const src = `/photos/${ph.file}.jpg`;
              const on = page.stills.includes(src);
              return (
                <li
                  key={ph.file}
                  className={cn(
                    'border-2 p-2',
                    on ? 'border-ink bg-gold-soft' : 'border-line-light bg-white',
                  )}
                >
                  <PhotoFrame photo={ph} ratio="3:2" sizes="(min-width: 1024px) 18vw, 45vw" />
                  <Checkbox
                    checked={on}
                    onCheckedChange={(v) => toggle(src, v)}
                    label={<span className="text-meta">Afficher</span>}
                    hint={ph.alt}
                  />
                </li>
              );
            })}
          </ul>
        </section>
        <Field
          label="Lien de la bande-annonce"
          optional
          hint="Vimeo, YouTube… (lien public ou privé avec mot de passe)"
          error={trailerOk ? undefined : 'Le lien doit commencer par https://'}
        >
          <Input
            type="url"
            value={page.trailer_url ?? ''}
            onChange={(e) => setPage((p) => ({ ...p, trailer_url: e.target.value.trim() || undefined }))}
            placeholder="https://"
          />
        </Field>
        <p role="status" className="text-meta text-muted-on-light">
          {saveState === 'saving' || saveState === 'pending'
            ? 'Enregistrement…'
            : saveState === 'error'
              ? 'Échec de l’enregistrement : une copie reste dans ce navigateur.'
              : 'Enregistré automatiquement dans ton projet.'}
        </p>
      </div>

      <aside className="lg:col-span-5">
        <div className="flex flex-col gap-4 border-2 border-ink bg-white p-5 shadow-hard">
          <p className="eyebrow">Dossier de presse en ligne</p>
          <p className="font-display text-h3 font-bold">{project.title}</p>
          <ul>
            <Check ok label="Titre et réalisation" />
            <Check
              ok={!!(synopsis.court || synopsis.phrase)}
              label="Synopsis court"
              to="/festival?onglet=synopsis"
            />
            <Check ok={!!synopsis.long} label="Synopsis long" to="/festival?onglet=synopsis" />
            <Check ok={page.stills.length > 0} label={`Photos (${page.stills.length})`} />
            <Check ok={credits > 0} label={`Générique (${credits} personnes)`} to="/planner/projet?etape=4" />
            <Check ok={!!page.trailer_url && trailerOk} label="Bande-annonce" />
            <Check
              ok={!!passport.data?.badge_code}
              label="Badge Passeport IA et lien de vérification"
              to="/passeport"
            />
          </ul>
          <p className="font-mono text-label break-all text-muted-on-light">{url}</p>
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/film/${project.id}`}
              target="_blank"
              className="inline-flex min-h-11 items-center gap-1.5 border-2 border-action bg-action px-4 font-semibold text-white hover:bg-action-hover"
            >
              <Icon name="external" size={16} /> Voir la page publique
            </Link>
            <Button
              variant="secondary"
              icon="copy"
              onClick={() =>
                void copyToClipboard(url).then((ok) =>
                  toast(
                    ok
                      ? { tone: 'ok', title: 'Lien de la page film copié' }
                      : { tone: 'bad', title: 'Copie impossible' },
                  ),
                )
              }
            >
              Copier le lien
            </Button>
          </div>
          <p className="text-meta text-muted-on-light">À envoyer aux festivals avec ta candidature.</p>
        </div>
      </aside>
    </div>
  );
}
