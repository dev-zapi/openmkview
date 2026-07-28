# Offline Read-Only PWA via Service Worker

OpenMKView is a self-hosted single-user Markdown previewer. We decided to make it an installable PWA that keeps working when the server is unreachable: the app shell boots from a precache, and previously viewed file lists and file contents stay readable. Editing is explicitly out of scope offline.

**Decision:**
- `vite-plugin-pwa` (workbox `generateSW`) precaches all build assets; `registerType: 'autoUpdate'` (skipWaiting + clientsClaim) so deployed versions take effect without user interaction.
- Runtime caching is blacklist-based: all `/api/` GET requests use StaleWhileRevalidate (`/api/files/` capped at 200 entries / 30 days, other GETs at 50), except `/api/auth/*` which is `NetworkOnly` — passkey challenges are single-use and session responses must never be cached.
- `authStore.checkStatus` distinguishes an explicit 401 (mark unauthenticated) from a network failure (keep current session state). No "logged in" flag is persisted anywhere.
- Offline UX is quiet but visible: a small "Offline Mode" badge driven by `online`/`offline` events; opening uncached content shows an empty-state message; the Edit tab is blocked with a prompt.
- The backend sets `Cache-Control` on static files: `index.html`/`manifest.json`/`sw.js` are `no-cache` (so SW update checks are never stalled by heuristic HTTP caching), hashed `assets/` are `immutable` for a year.
- Dev mode runs without the SW; verification is done against the production build.

**Considered Options:**
- Offline read-write with sync — rejected: requires a sync protocol and conflict resolution, poor fit for a single-user previewer.
- Prefetching entire projects for offline use — rejected: unbounded storage and request storms for marginal benefit; may be revisited as an explicit "pin for offline" feature.
- Hand-written service worker — rejected: maintaining the hashed-asset precache manifest by hand is the most error-prone part; workbox generates it.
- `prompt` update flow — rejected: front- and backend deploy together, and a click-to-update prompt is noise in a single-user deployment.
- Whitelist of cacheable API routes — rejected: new read-only endpoints should gain offline behavior by default; the auth blacklist covers the dangerous cases.

**Consequences:**
- A failed `/api/auth/status` request no longer logs the user out; only an explicit 401 does.
- Playwright offline tests must avoid full-page navigations after `setOffline(true)`: Chromium's offline emulation silently stops blocking requests after a navigation while `navigator.onLine` still reports `false`. Offline assertions run in-page; the full reload check is only a boot smoke.
- `workbox.maximumFileSizeToCacheInBytes` is raised to 5 MiB because the shiki highlighting worker (~2.8 MB) must be available offline.
- Authenticated responses are stored in the browser's Cache Storage; acceptable for a single-user self-hosted deployment, but shared-machine users should log out to clear site data.
