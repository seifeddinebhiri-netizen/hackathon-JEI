import { useSyncExternalStore } from 'react';
import { Icon } from '@/components/ui';

function subscribe(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

/** Bandeau hors ligne : l'application reste consultable, les modifications attendent le retour du réseau. */
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <div role="status" className="no-print sticky top-0 z-50 bg-gold text-ink">
      <p className="container-pp flex min-h-11 items-center gap-2 py-2 text-meta font-semibold">
        <Icon name="cloud" size={16} />
        Hors ligne : tu peux consulter les pages déjà ouvertes. Les modifications et la météo reviendront avec
        le réseau.
      </p>
    </div>
  );
}
