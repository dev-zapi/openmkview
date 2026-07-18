import type { Heading } from '../types';

export function computeActiveHeading(visibleIds: Set<string>, headings: Heading[]): string | null {
  let lastVisible: string | null = null;
  for (const heading of headings) {
    if (visibleIds.has(heading.id)) {
      lastVisible = heading.id;
    }
  }
  return lastVisible;
}
