import { createRenderEffect, onMount, splitProps, type Component, type ComponentProps } from 'solid-js';
import { cn } from './cn';

export interface SelectProps extends ComponentProps<'select'> {}

/**
 * Select — styled native <select> (not a custom listbox).
 * All existing selects use native semantics; a custom listbox would break
 * form behaviour and E2E for zero benefit. Renders an SVG chevron overlay.
 */
export const Select: Component<SelectProps> = (props) => {
  const [local, rest] = splitProps(props, ['class', 'classList', 'children', 'value']);
  let selectRef: HTMLSelectElement | undefined;

  // Sync the value as a DOM property (not attribute) so controlled selects work
  createRenderEffect(() => {
    if (selectRef && local.value !== undefined) {
      selectRef.value = String(local.value);
    }
  });

  // Also set on mount in case the ref wasn't ready during render
  onMount(() => {
    if (selectRef && local.value !== undefined) {
      selectRef.value = String(local.value);
    }
  });

  return (
    <span class="relative inline-flex items-center w-full">
      <select
        {...rest}
        ref={selectRef}
        class={cn(
          'flex h-9 w-full appearance-none items-center rounded-md border border-input bg-secondary pl-3 pr-8 py-1 text-sm',
          'transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:cursor-not-allowed disabled:opacity-50',
          local.class,
        )}
        classList={local.classList}
      >
        {local.children}
      </select>
      <svg
        class="pointer-events-none absolute right-2 h-4 w-4 opacity-60"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </span>
  );
};

export default Select;
