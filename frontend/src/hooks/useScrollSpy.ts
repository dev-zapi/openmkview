import { createSignal, createEffect, onCleanup, type Accessor } from 'solid-js';
import type { Heading } from '../types';
import { computeActiveHeading } from '../utils/scrollSpy';

const LOCKOUT_MS = 600;

export function useScrollSpy(
  headings: Accessor<Heading[]>,
  enabled: Accessor<boolean>,
) {
  const [activeHeadingId, setActiveHeadingId] = createSignal<string | null>(null);
  let lockoutTimer: ReturnType<typeof setTimeout> | undefined;
  let isLockedOut = false;

  const lockForProgrammaticScroll = (id: string) => {
    setActiveHeadingId(id);
    isLockedOut = true;
    if (lockoutTimer) clearTimeout(lockoutTimer);
    lockoutTimer = setTimeout(() => {
      isLockedOut = false;
    }, LOCKOUT_MS);
  };

  createEffect(() => {
    if (!enabled()) {
      setActiveHeadingId(null);
      return;
    }

    const visibleIds = new Set<string>();

    const observer = new IntersectionObserver(
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

        setActiveHeadingId(computeActiveHeading(visibleIds, headings()));
      },
      {
        root: document.querySelector('.content-main'),
        rootMargin: '-80px 0px 0px 0px',
        threshold: 0,
      },
    );

    const currentHeadings = headings();
    for (const heading of currentHeadings) {
      const el = document.getElementById(heading.id);
      if (el) observer.observe(el);
    }

    onCleanup(() => {
      observer.disconnect();
      visibleIds.clear();
      if (lockoutTimer) clearTimeout(lockoutTimer);
      isLockedOut = false;
    });
  });

  return { activeHeadingId, lockForProgrammaticScroll };
}
