export type ForceRefreshStatus = 'checking' | 'updating' | 'reloading';

/**
 * Force the PWA to pick up the newest deployed version: ask the service worker
 * for an update, drop cached app files, then reload. The reload happens in
 * finally so a failed update check still gives the user a fresh page.
 */
export async function forceRefreshApp(
  onStatus: (status: ForceRefreshStatus) => void,
): Promise<void> {
  onStatus('checking');

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      onStatus('updating');
      await Promise.all(
        registrations.map((registration) => registration.update().catch(() => undefined)),
      );
      registrations.forEach((registration) => registration.waiting?.postMessage({ type: 'SKIP_WAITING' }));
    }

    onStatus('reloading');
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } finally {
    window.location.reload();
  }
}
