/**
 * PROTOTYPE — throwaway. Delete once the placement question is answered.
 *
 * Question: where should the "force refresh PWA version" control live, and what
 * should it look like? Three structurally different placements for the settings
 * footer, switchable with ?variant=A|B|C via the floating bar below.
 *
 * A · Inline footer action — version text + small outline button in one row.
 * B · About section card    — version moves into a dedicated card at the end of
 *                             the settings content; footer keeps only Save.
 * C · Version chip + confirm — version becomes a clickable pill that opens a
 *                             confirmation popover ("unsaved changes lost").
 */
import { Component, For, Show, createSignal, onCleanup, onMount } from 'solid-js';
import { Button } from '../ui';

export type RefreshVariant = 'A' | 'B' | 'C';

const VARIANTS: { key: RefreshVariant; name: string }[] = [
  { key: 'A', name: 'Inline footer action' },
  { key: 'B', name: 'About section card' },
  { key: 'C', name: 'Version chip + confirm' },
];

function readVariant(): RefreshVariant {
  const value = new URLSearchParams(window.location.search).get('variant')?.toUpperCase();
  return value === 'B' || value === 'C' ? value : 'A';
}

const [variant, setVariantSignal] = createSignal<RefreshVariant>(readVariant());

export const prototypeVariant = variant;

export function setPrototypeVariant(next: RefreshVariant) {
  setVariantSignal(next);
  const url = new URL(window.location.href);
  url.searchParams.set('variant', next);
  window.history.replaceState({}, '', url);
}

type RefreshStatus = 'idle' | 'checking' | 'updating' | 'reloading' | 'done';

const STATUS_LABEL: Record<RefreshStatus, string> = {
  idle: 'Refresh',
  checking: 'Checking…',
  updating: 'Refreshing…',
  reloading: 'Reloading…',
  done: 'Refreshed',
};

const isBusy = (status: RefreshStatus) => status !== 'idle' && status !== 'done';

/**
 * Prototype copy of the real update path. With a service worker it updates
 * registrations, clears caches, then reloads. In dev there is no service
 * worker (vite-plugin-pwa is disabled there), so it only simulates the states
 * — never reload, or flipping variants would be miserable.
 */
async function forceRefreshPwa(setStatus: (next: RefreshStatus) => void) {
  setStatus('checking');

  const simulate = async () => {
    setStatus('updating');
    await new Promise((resolve) => setTimeout(resolve, 900));
    setStatus('done');
    setTimeout(() => setStatus('idle'), 2500);
  };

  if (!('serviceWorker' in navigator)) {
    await simulate();
    return;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    // Dev has the serviceWorker API but no registration (vite-plugin-pwa is
    // disabled in serve mode) — simulate rather than reload mid-prototype.
    if (registrations.length === 0) {
      await simulate();
      return;
    }

    setStatus('updating');
    await Promise.all(registrations.map((registration) => registration.update().catch(() => undefined)));
    registrations.forEach((registration) => registration.waiting?.postMessage({ type: 'SKIP_WAITING' }));
    setStatus('reloading');
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
    setTimeout(() => window.location.reload(), 500);
  } catch {
    setStatus('done');
    setTimeout(() => setStatus('idle'), 2500);
  }
}

const refreshIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 3v6h-6" />
  </svg>
);

interface VersionProps {
  version: string;
  buildTime: string;
}

/* ── A · Inline footer action ───────────────────────────────────────────── */

export const VariantAFooter: Component<VersionProps> = (props) => {
  const [status, setStatus] = createSignal<RefreshStatus>('idle');

  return (
    <div style="display:flex;flex-direction:column;gap:4px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <span class="settings-version" style="opacity:0.85;">{props.version}</span>
        <button
          type="button"
          onClick={() => void forceRefreshPwa(setStatus)}
          disabled={isBusy(status())}
          style={{
            display: 'inline-flex',
            'align-items': 'center',
            gap: '4px',
            padding: '2px 8px',
            border: '1px solid hsl(var(--border))',
            'border-radius': '6px',
            background: 'transparent',
            color: 'hsl(var(--muted-foreground))',
            'font-size': '11px',
            cursor: isBusy(status()) ? 'default' : 'pointer',
            opacity: isBusy(status()) ? '0.6' : '1',
          }}
        >
          {refreshIcon}
          {STATUS_LABEL[status()]}
        </button>
      </div>
      <span class="settings-build-time">Build Time: {props.buildTime}</span>
    </div>
  );
};

/* ── B · About section card (rendered in the settings content) ──────────── */

export const VariantBAboutCard: Component<VersionProps> = (props) => {
  const [status, setStatus] = createSignal<RefreshStatus>('idle');

  return (
    <div class="settings-section" id="settings-about">
      <h4>About</h4>

      <div
        style={{
          border: '1px solid hsl(var(--border))',
          'border-radius': 'var(--radius-lg)',
          padding: '16px',
          display: 'flex',
          'flex-direction': 'column',
          gap: '12px',
        }}
      >
        <div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;">
          <span style="font-size:15px;font-weight:600;color:hsl(var(--foreground));">{props.version}</span>
          <span style="font-size:11px;color:hsl(var(--muted-foreground));opacity:0.7;">Build Time: {props.buildTime}</span>
        </div>

        <p style="margin:0;font-size:12px;color:hsl(var(--muted-foreground));opacity:0.85;">
          Refreshing clears cached app files and loads the newest version. Unsaved settings changes will be lost.
        </p>

        <Button
          type="button"
          variant="default"
          onClick={() => void forceRefreshPwa(setStatus)}
          disabled={isBusy(status())}
          style="align-self:flex-start;"
        >
          {refreshIcon}
          {status() === 'idle' ? 'Force refresh app' : STATUS_LABEL[status()]}
        </Button>
      </div>
    </div>
  );
};

/* ── C · Version chip + confirmation popover ─────────────────────────────── */

export const VariantCFooter: Component<VersionProps> = (props) => {
  const [status, setStatus] = createSignal<RefreshStatus>('idle');
  const [open, setOpen] = createSignal(false);

  const confirmRefresh = () => {
    setOpen(false);
    void forceRefreshPwa(setStatus);
  };

  return (
    <div style="position:relative;display:flex;flex-direction:column;gap:3px;">
      <div style="display:flex;align-items:center;gap:8px;">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open()}
          style={{
            display: 'inline-flex',
            'align-items': 'center',
            gap: '6px',
            padding: '3px 10px',
            border: '1px solid hsl(var(--border))',
            'border-radius': '999px',
            background: open() ? 'hsl(var(--secondary))' : 'transparent',
            color: 'hsl(var(--muted-foreground))',
            'font-size': '12px',
            cursor: 'pointer',
          }}
        >
          {props.version}
          <span style="opacity:0.7;">{refreshIcon}</span>
        </button>
        <Show when={isBusy(status())}>
          <span style="font-size:11px;color:hsl(var(--muted-foreground));">{STATUS_LABEL[status()]}</span>
        </Show>
        <Show when={status() === 'done'}>
          <span style="font-size:11px;color:hsl(var(--muted-foreground));">Up to date ✓</span>
        </Show>
      </div>

      <span class="settings-build-time">Build Time: {props.buildTime}</span>

      <Show when={open()}>
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 10px)',
            left: '0',
            width: '280px',
            padding: '14px',
            'border-radius': '10px',
            border: '1px solid hsl(var(--border))',
            background: 'hsl(var(--popover, var(--background)))',
            'box-shadow': '0 8px 24px rgba(0, 0, 0, 0.35)',
            'z-index': '20',
          }}
        >
          <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:hsl(var(--foreground));">Force refresh the app?</p>
          <p style="margin:0 0 12px;font-size:12px;line-height:1.5;color:hsl(var(--muted-foreground));">
            Clears cached app files and loads the newest version. Unsaved settings changes will be lost.
          </p>
          <div style="display:flex;justify-content:flex-end;gap:8px;">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="default" size="sm" onClick={confirmRefresh}>
              Refresh now
            </Button>
          </div>
        </div>
      </Show>
    </div>
  );
};

/* ── Floating variant switcher ──────────────────────────────────────────── */

export const VersionRefreshSwitcher: Component = () => {
  if (import.meta.env.PROD) {
    return null;
  }

  const currentIndex = () => VARIANTS.findIndex((item) => item.key === prototypeVariant());
  const currentName = () => VARIANTS[currentIndex()]?.name ?? '';

  const cycle = (direction: number) => {
    const index = currentIndex();
    const next = VARIANTS[(index + direction + VARIANTS.length) % VARIANTS.length];
    setPrototypeVariant(next.key);
  };

  onMount(() => {
    const handleKey = (event: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      if (
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.tagName === 'SELECT' ||
          active.isContentEditable)
      ) {
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        cycle(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        cycle(1);
      }
    };
    window.addEventListener('keydown', handleKey);
    onCleanup(() => window.removeEventListener('keydown', handleKey));
  });

  return (
    <div
      onClick={(event) => event.stopPropagation()}
      style={{
        position: 'fixed',
        bottom: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        'align-items': 'center',
        gap: '10px',
        padding: '6px 10px',
        'border-radius': '999px',
        background: 'rgba(20, 20, 20, 0.92)',
        color: '#fff',
        'box-shadow': '0 6px 20px rgba(0, 0, 0, 0.4)',
        'z-index': '3000',
        'font-size': '12px',
        'white-space': 'nowrap',
      }}
    >
      <button
        type="button"
        aria-label="Previous variant"
        onClick={() => cycle(-1)}
        style="background:none;border:none;color:#fff;font-size:16px;line-height:1;padding:2px 6px;cursor:pointer;"
      >
        ‹
      </button>
      <span>
        PROTOTYPE · <strong>{prototypeVariant()}</strong> — {currentName()}
      </span>
      <button
        type="button"
        aria-label="Next variant"
        onClick={() => cycle(1)}
        style="background:none;border:none;color:#fff;font-size:16px;line-height:1;padding:2px 6px;cursor:pointer;"
      >
        ›
      </button>
      <For each={VARIANTS}>
        {(item) => (
          <button
            type="button"
            onClick={() => setPrototypeVariant(item.key)}
            style={{
              'border-radius': '999px',
              border: '1px solid rgba(255,255,255,0.25)',
              background: prototypeVariant() === item.key ? 'rgba(255,255,255,0.18)' : 'transparent',
              color: '#fff',
              'font-size': '11px',
              padding: '2px 8px',
              cursor: 'pointer',
            }}
          >
            {item.key}
          </button>
        )}
      </For>
    </div>
  );
};
