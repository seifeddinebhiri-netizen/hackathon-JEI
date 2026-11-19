import { useIsMutating } from '@tanstack/react-query';
import { useState, type KeyboardEvent } from 'react';
import { Button, Icon } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { SyncStatus } from '../useWorkspaceSync';
import { MAX_WORKSPACES, NAME_MAX, type Workspace } from '../workspaces';

function statusOf(ws: Workspace, generating: boolean): string {
  if (generating) return 'génération…';
  if (!ws.plan) return 'vide';
  const n = ws.plan.spec.shots.length;
  return `${n} plan${n > 1 ? 's' : ''}`;
}

export type SyncInfo = { status: SyncStatus; message: string; lastSyncedAt: string | null };

const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

/** Où sont gardés les espaces : seulement ce téléphone, ou aussi le compte. */
function SyncLine({ sync }: { sync: SyncInfo }) {
  const text =
    sync.status === 'off'
      ? 'Gardés dans ce téléphone seulement. Avec un compte, tu les retrouves sur tes autres appareils.'
      : sync.status === 'syncing'
        ? 'Enregistrement sur ton compte…'
        : sync.status === 'synced'
          ? `Enregistrés sur ton compte${sync.lastSyncedAt ? ` à ${hhmm(sync.lastSyncedAt)}` : ''}.`
          : sync.message;
  const bad = sync.status === 'error';
  return (
    <p
      role="status"
      className={cn(
        'flex items-start gap-2 text-meta',
        bad ? 'font-semibold text-bad-fg' : 'text-muted-on-light',
      )}
    >
      <Icon
        name={bad || sync.status === 'offline' ? 'alert' : sync.status === 'synced' ? 'check' : 'info'}
        size={16}
        className="mt-0.5 shrink-0"
      />
      {text}
    </p>
  );
}

function Tab({ ws, selected, onSelect }: { ws: Workspace; selected: boolean; onSelect: () => void }) {
  const generating = useIsMutating({ mutationKey: ['coach', 'generate', ws.id] }) > 0;
  return (
    <button
      type="button"
      role="tab"
      id={`espace-onglet-${ws.id}`}
      aria-selected={selected}
      aria-controls={`espace-${ws.id}`}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      className={cn(
        'flex min-h-14 shrink-0 flex-col items-start justify-center border-2 border-ink px-4 text-left',
        selected ? 'bg-ink text-paper shadow-hard-sm' : 'bg-white text-ink hover:bg-gold-soft',
      )}
    >
      <span className="max-w-[11rem] truncate font-semibold">{ws.name}</span>
      <span className={cn('text-label', selected ? 'text-muted-on-dark' : 'text-muted-on-light')}>
        {statusOf(ws, generating)}
      </span>
    </button>
  );
}

/** Barre des espaces de travail : un espace par scène, un nouveau pour la scène suivante. */
export function WorkspaceBar({
  items,
  activeId,
  onSelect,
  onCreate,
  onRename,
  onRemove,
  sync,
}: {
  items: Workspace[];
  activeId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  sync: SyncInfo;
}) {
  const active = items.find((w) => w.id === activeId) ?? items[0];
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState('');
  const full = items.length >= MAX_WORKSPACES;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = items.findIndex((w) => w.id === activeId);
    const next = items[(i + (e.key === 'ArrowRight' ? 1 : items.length - 1)) % items.length];
    onSelect(next.id);
    document.getElementById(`espace-onglet-${next.id}`)?.focus();
    e.preventDefault();
  };

  const startRename = () => {
    setDraft(active.name);
    setRenaming(true);
  };
  const saveRename = () => {
    onRename(active.id, draft);
    setRenaming(false);
  };

  return (
    <section aria-label="Espaces de travail" className="flex flex-col gap-3">
      <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
        <div role="tablist" aria-label="Espaces de travail" onKeyDown={onKeyDown} className="flex gap-2">
          {items.map((ws) => (
            <Tab key={ws.id} ws={ws} selected={ws.id === active.id} onSelect={() => onSelect(ws.id)} />
          ))}
        </div>
        <Button
          variant="secondary"
          icon="plus"
          className="shrink-0"
          onClick={onCreate}
          disabled={full}
          title={
            full ? `${MAX_WORKSPACES} espaces au maximum : supprime-en un pour en créer un autre.` : undefined
          }
        >
          Nouvel espace
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {renaming ? (
          <>
            <input
              aria-label="Nom de l’espace"
              autoFocus
              value={draft}
              maxLength={NAME_MAX}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveRename();
                if (e.key === 'Escape') setRenaming(false);
              }}
              className="min-h-11 border-2 border-ink bg-white px-3"
            />
            <Button size="sm" onClick={saveRename}>
              Enregistrer le nom
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRenaming(false)}>
              Annuler
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="ghost" icon="edit" onClick={startRename}>
              Renommer cet espace
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon="trash"
              onClick={() => {
                if (
                  window.confirm(
                    `Supprimer l’espace « ${active.name} » ? Son plan et ses modifications seront perdus.`,
                  )
                )
                  onRemove(active.id);
              }}
            >
              Supprimer cet espace
            </Button>
          </>
        )}
      </div>

      <SyncLine sync={sync} />
      {active.plan ? (
        <p className="flex items-start gap-2 text-meta text-muted-on-light">
          <Icon name="info" size={16} className="mt-0.5 shrink-0" />
          Tu as fini cette scène ? Crée un nouvel espace pour la suivante : celui-ci reste tel quel, avec son
          plan et tes modifications.
        </p>
      ) : null}
    </section>
  );
}
