import type { RefObject } from 'react';
import type { SubtitleLine } from '@/api/types';
import { Button, Icon, Input, StatusChip } from '@/components/ui';
import { CONFIDENCE_ICONS, CONFIDENCE_LABELS, CONFIDENCE_TONES, RULE_LABELS } from '../../lib/labels';
import { lineText, type SrtLang } from '../../lib/srt';

export function Kbd({ children }: { children: string }) {
  return <kbd className="border border-current px-1.5 py-0.5 font-mono text-label">{children}</kbd>;
}

const LANG_LABEL: Record<SrtLang, string> = { en: 'Anglais', fr: 'Français' };

/** Version condensée proposée par l'IA : rien ne change tant que la personne ne l'accepte pas. */
function ShortSuggestion({
  lang,
  text,
  onUse,
  onDismiss,
}: {
  lang: SrtLang;
  text: string;
  onUse: () => void;
  onDismiss: () => void;
}) {
  const label = LANG_LABEL[lang].toLowerCase();
  return (
    <div className="flex flex-col items-start gap-2 border-l-4 border-gold bg-gold-soft/60 p-3 text-meta">
      <p>
        <strong>Version courte proposée ({text.length} car.) : </strong>
        <span lang={lang}>{text}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={onUse}
          aria-label={`Utiliser la version courte en ${label}`}
        >
          Utiliser
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDismiss}
          aria-label={`Ignorer la version courte en ${label}`}
        >
          Ignorer
        </Button>
      </div>
    </div>
  );
}

/**
 * Ligne en cours : tout ce que la relecture doit voir (confiance, note, avertissements,
 * version courte, texte FR / EN modifiable) puis la décision : valider ou revoir.
 */
export function LinePanel({
  line,
  lang,
  reason,
  hasVideo,
  isLast,
  inputRef,
  onEdit,
  onUseShort,
  onDismissShort,
  onFocusField,
  onValidate,
  onReplay,
  onUnvalidate,
}: {
  line: SubtitleLine;
  lang: SrtLang;
  /** Pourquoi cette ligne est à vérifier (null : rien de signalé). */
  reason: string | null;
  hasVideo: boolean;
  isLast: boolean;
  inputRef: RefObject<HTMLInputElement>;
  onEdit: (lang: SrtLang, value: string) => void;
  onUseShort: (lang: SrtLang) => void;
  onDismissShort: (lang: SrtLang) => void;
  onFocusField: () => void;
  onValidate: () => void;
  onReplay: () => void;
  onUnvalidate: () => void;
}) {
  const order: SrtLang[] = lang === 'en' ? ['en', 'fr'] : ['fr', 'en'];
  return (
    <aside
      aria-label="Ligne en cours"
      className="flex flex-col gap-4 border-2 border-ink bg-white p-4 md:p-5 lg:col-span-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-label text-muted-on-light">
          {line.start} → {line.end}
        </span>
        {line.speaker ? (
          <StatusChip icon="user" tone="neutral">
            Locuteur {line.speaker}
          </StatusChip>
        ) : null}
        <StatusChip tone={CONFIDENCE_TONES[line.confidence]} icon={CONFIDENCE_ICONS[line.confidence]}>
          {CONFIDENCE_LABELS[line.confidence]}
        </StatusChip>
        {line.validated ? (
          <StatusChip tone="ok" icon="check">
            Validée
          </StatusChip>
        ) : null}
      </div>

      {reason ? (
        <p className="flex items-start gap-2 border-2 border-warn-fg/30 bg-warn-bg p-3 text-meta text-warn-fg">
          <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
          <span>
            <strong>À vérifier : </strong>
            {reason}
          </span>
        </p>
      ) : null}

      <div>
        <p className="eyebrow text-muted-on-light">Ce qui est dit</p>
        <p className="font-semibold" lang="aeb">
          {line.source}
        </p>
      </div>

      {order.map((lg) => {
        const short = lg === 'fr' ? line.fr_court : line.en_court;
        return (
          <div key={lg} className="flex flex-col gap-2">
            <label className="flex flex-col gap-1.5 text-meta font-semibold">
              {LANG_LABEL[lg]}
              <Input
                ref={lg === lang ? inputRef : undefined}
                lang={lg}
                value={(lg === 'fr' ? line.fr : line.en) ?? ''}
                onFocus={onFocusField}
                onChange={(e) => onEdit(lg, e.target.value)}
              />
            </label>
            {short ? (
              <ShortSuggestion
                lang={lg}
                text={short}
                onUse={() => onUseShort(lg)}
                onDismiss={() => onDismissShort(lg)}
              />
            ) : null}
          </div>
        );
      })}

      {line.note ? (
        <p className="flex items-start gap-2 border-l-4 border-gold bg-gold-soft/60 p-3 text-meta">
          <Icon name="doc" size={16} className="mt-0.5 shrink-0" />
          <span>
            <strong>{line.glossary_used?.length ? 'Glossaire derja : ' : 'Note du traducteur : '}</strong>
            {line.note}
          </span>
        </p>
      ) : null}

      {line.warnings?.length ? (
        <ul className="flex flex-col gap-2" aria-label="Avertissements">
          {line.warnings.map((w) => (
            <li
              key={w.rule + w.detail}
              className="flex items-start gap-2 border-2 border-warn-fg/30 bg-warn-bg p-3 text-meta text-warn-fg"
            >
              <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
              <span>
                <strong>{RULE_LABELS[w.rule]} : </strong>
                {w.detail}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {lineText(line, lang) ? null : (
        <p className="text-meta font-semibold text-warn-fg">
          Cette ligne n’a pas de texte {lang === 'en' ? 'anglais' : 'français'} : écris-le avant de valider.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {line.validated ? (
          <Button variant="secondary" onClick={onUnvalidate}>
            Annuler la validation
          </Button>
        ) : (
          <Button onClick={onValidate} icon="check">
            {isLast ? 'Valider' : 'Valider et continuer'} <Kbd>Entrée</Kbd>
          </Button>
        )}
        {hasVideo ? (
          <Button variant="secondary" onClick={onReplay}>
            Revoir <Kbd>R</Kbd>
          </Button>
        ) : null}
      </div>
      <p className="text-meta text-muted-on-light">
        Raccourcis : {hasVideo ? 'Espace lecture · ' : ''}Entrée valider · E modifier
        {hasVideo ? ' · R revoir' : ''} · ← → ligne. Inactifs quand tu écris dans un champ.
      </p>
    </aside>
  );
}
