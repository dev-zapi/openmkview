import type { Heading } from '../types';

export function computeActiveHeading(visibleIds: Set<string>, headings: Heading[]): string | null {
  for (const heading of headings) {
    if (visibleIds.has(heading.id)) {
      return heading.id;
    }
  }
  return null;
}
