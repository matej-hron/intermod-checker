import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

export function OfflineChip() {
  const online = useSyncExternalStore(
    subscribe,
    () => window.navigator.onLine,
    () => true,
  );

  if (online) return null;

  // Reassurance, not a warning: every calculation runs in this browser, so
  // losing signal changes nothing about what the tool can do.
  return (
    <span className="badge badge--good" role="status">
      Offline — still works
    </span>
  );
}
