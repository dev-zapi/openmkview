/**
 * cn — tiny classnames merge (no clsx/tailwind-merge deps).
 * Filters falsy values and joins with space.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
