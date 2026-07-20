import { createSignal, createEffect, onCleanup, type Accessor } from 'solid-js';
import type { Heading } from '../types';
import { computeActiveHeading } from '../utils/scrollSpy';

function headingsEqual(a: Heading[], b: Heading[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].depth !== b[i].depth || a[i].text !== b[i].text) {
      return false;
    }
  }
  return true;
}

export function useScrollSpy(
  headings: Accessor<Heading[]>,
  enabled: Accessor<boolean>,
) {
  const [activeHeadingId, setActiveHeadingId] = createSignal<string | null>(null);
  let isLockedOut = false;
  let lastHeadings: Heading[] = [];
  let observer: IntersectionObserver | null = null;
  let visibleIds = new Set<string>();
  let lastActiveId: string | null = null;

  const lockForProgrammaticScroll = (id: string) => {
    setActiveHeadingId(id);
    isLockedOut = true;

    const contentMain = document.querySelector('.content-main');
    if (contentMain) {
      const releaseLock = () => {
        isLockedOut = false;
      };
      contentMain.addEventListener('scrollend', releaseLock, { once: true });
    }

    setTimeout(() => {
      isLockedOut = false;
    }, 2000);
  };

  const rebuildObserver = () => {
    if (observer) {
      observer.disconnect();
      visibleIds.clear();
    }

    const currentHeadings = headings();
    if (currentHeadings.length === 0) {
      observer = null;
      return;
    }

    observer = new IntersectionObserver(
      (entries) => {
        if (isLockedOut) return;

        for (const entry of entries) {
          const id = (entry.target as HTMLElement).id;
          if (entry.isIntersecting) {
            visibleIds.add(id);
          } else {
            visibleIds.delete(id);
          }
        }

        const activeId = computeActiveHeading(visibleIds, currentHeadings);
        if (activeId !== null) {
          lastActiveId = activeId;
          setActiveHeadingId(activeId);
        } else if (lastActiveId !== null) {
          setActiveHeadingId(lastActiveId);
        }
      },
      {
        root: document.querySelector('.content-main'),
        rootMargin: '0px 0px -50% 0px',
        threshold: 0,
      },
    );

    for (const heading of currentHeadings) {
      const el = document.getElementById(heading.id);
      if (el) observer.observe(el);
    }
  };

  createEffect(() => {
    if (!enabled()) {
      setActiveHeadingId(null);
      if (observer) {
        observer.disconnect();
        observer = null;
        visibleIds.clear();
      }
      return;
    }

    const currentHeadings = headings();
    if (headingsEqual(lastHeadings, currentHeadings)) {
      return;
    }
    lastHeadings = currentHeadings;

    rebuildObserver();
  });

  onCleanup(() => {
    if (observer) {
      observer.disconnect();
    }
    visibleIds.clear();
    isLockedOut = false;
  });

  return { activeHeadingId, lockForProgrammaticScroll };
}
