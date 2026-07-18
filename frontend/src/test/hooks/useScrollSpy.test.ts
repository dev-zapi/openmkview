import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'solid-js';
import { useScrollSpy } from '../../hooks/useScrollSpy';
import type { Heading } from '../../types';

describe('useScrollSpy', () => {
  const headings: Heading[] = [
    { depth: 1, text: 'Introduction', id: 'introduction' },
    { depth: 2, text: 'Getting Started', id: 'getting-started' },
    { depth: 2, text: 'Installation', id: 'installation' },
  ];

  let mockObserve: ReturnType<typeof vi.fn>;
  let mockUnobserve: ReturnType<typeof vi.fn>;
  let mockDisconnect: ReturnType<typeof vi.fn>;
  let observerCallback: IntersectionObserverCallback;

  beforeEach(() => {
    mockObserve = vi.fn();
    mockUnobserve = vi.fn();
    mockDisconnect = vi.fn();

    const MockIntersectionObserver = vi.fn(function (this: any, callback: IntersectionObserverCallback) {
      observerCallback = callback;
      this.observe = mockObserve;
      this.unobserve = mockUnobserve;
      this.disconnect = mockDisconnect;
    });
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when disabled', () => {
    createRoot((dispose) => {
      const { activeHeadingId } = useScrollSpy(() => headings, () => false);
      expect(activeHeadingId()).toBeNull();
      dispose();
    });
  });

  it('does not create observer when disabled', () => {
    createRoot((dispose) => {
      useScrollSpy(() => headings, () => false);
      expect(IntersectionObserver).not.toHaveBeenCalled();
      dispose();
    });
  });

  it('creates observer when enabled', async () => {
    await createRoot(async (dispose) => {
      useScrollSpy(() => headings, () => true);
      await Promise.resolve();
      expect(IntersectionObserver).toHaveBeenCalled();
      dispose();
    });
  });

  it('observes heading elements when enabled', async () => {
    await createRoot(async (dispose) => {
      const container = document.createElement('div');
      headings.forEach((h) => {
        const el = document.createElement('h2');
        el.id = h.id;
        container.appendChild(el);
      });
      document.body.appendChild(container);

      useScrollSpy(() => headings, () => true);
      await Promise.resolve();

      expect(mockObserve).toHaveBeenCalledTimes(headings.length);

      document.body.removeChild(container);
      dispose();
    });
  });

  it('updates active heading to the bottommost visible heading when observer fires', async () => {
    await createRoot(async (dispose) => {
      const container = document.createElement('div');
      container.className = 'content-main';
      headings.forEach((h) => {
        const el = document.createElement('h2');
        el.id = h.id;
        container.appendChild(el);
      });
      document.body.appendChild(container);

      const { activeHeadingId } = useScrollSpy(() => headings, () => true);
      await Promise.resolve();

      const introEl = document.getElementById('introduction')!;
      const gettingStartedEl = document.getElementById('getting-started')!;

      observerCallback(
        [
          { target: introEl, isIntersecting: true } as IntersectionObserverEntry,
          { target: gettingStartedEl, isIntersecting: true } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      );

      expect(activeHeadingId()).toBe('getting-started');

      document.body.removeChild(container);
      dispose();
    });
  });

  it('returns null when no headings are intersecting and no previous active', async () => {
    await createRoot(async (dispose) => {
      const container = document.createElement('div');
      container.className = 'content-main';
      headings.forEach((h) => {
        const el = document.createElement('h2');
        el.id = h.id;
        container.appendChild(el);
      });
      document.body.appendChild(container);

      const { activeHeadingId } = useScrollSpy(() => headings, () => true);
      await Promise.resolve();

      const introEl = document.getElementById('introduction')!;
      observerCallback(
        [{ target: introEl, isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );

      expect(activeHeadingId()).toBeNull();

      document.body.removeChild(container);
      dispose();
    });
  });

  it('keeps previous active heading when no headings are intersecting', async () => {
    await createRoot(async (dispose) => {
      const container = document.createElement('div');
      container.className = 'content-main';
      headings.forEach((h) => {
        const el = document.createElement('h2');
        el.id = h.id;
        container.appendChild(el);
      });
      document.body.appendChild(container);

      const { activeHeadingId } = useScrollSpy(() => headings, () => true);
      await Promise.resolve();

      const introEl = document.getElementById('introduction')!;
      observerCallback(
        [{ target: introEl, isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
      expect(activeHeadingId()).toBe('introduction');

      observerCallback(
        [{ target: introEl, isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
      expect(activeHeadingId()).toBe('introduction');

      document.body.removeChild(container);
      dispose();
    });
  });

  it('disconnects observer when disabled', async () => {
    await createRoot(async (dispose) => {
      const container = document.createElement('div');
      container.className = 'content-main';
      headings.forEach((h) => {
        const el = document.createElement('h2');
        el.id = h.id;
        container.appendChild(el);
      });
      document.body.appendChild(container);

      let isEnabled = true;

      useScrollSpy(() => headings, () => isEnabled);
      await Promise.resolve();
      expect(mockDisconnect).not.toHaveBeenCalled();

      isEnabled = false;
      dispose();
      expect(mockDisconnect).toHaveBeenCalled();

      document.body.removeChild(container);
    });
  });

  it('lockForProgrammaticScroll sets heading immediately and suppresses observer', async () => {
    await createRoot(async (dispose) => {
      const container = document.createElement('div');
      container.className = 'content-main';
      headings.forEach((h) => {
        const el = document.createElement('h2');
        el.id = h.id;
        container.appendChild(el);
      });
      document.body.appendChild(container);

      const { activeHeadingId, lockForProgrammaticScroll } = useScrollSpy(() => headings, () => true);
      await Promise.resolve();

      lockForProgrammaticScroll('installation');
      expect(activeHeadingId()).toBe('installation');

      const introEl = document.getElementById('introduction')!;
      observerCallback(
        [{ target: introEl, isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );

      expect(activeHeadingId()).toBe('installation');

      document.body.removeChild(container);
      dispose();
    });
  });

  it('observer updates resume after lockout expires', async () => {
    createRoot(async (dispose) => {
      const container = document.createElement('div');
      container.className = 'content-main';
      headings.forEach((h) => {
        const el = document.createElement('h2');
        el.id = h.id;
        container.appendChild(el);
      });
      document.body.appendChild(container);

      const { activeHeadingId, lockForProgrammaticScroll } = useScrollSpy(() => headings, () => true);

      lockForProgrammaticScroll('installation');
      expect(activeHeadingId()).toBe('installation');

      await new Promise((r) => setTimeout(r, 700));

      const introEl = document.getElementById('introduction')!;
      observerCallback(
        [{ target: introEl, isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );

      expect(activeHeadingId()).toBe('introduction');

      document.body.removeChild(container);
      dispose();
    });
  });
});
