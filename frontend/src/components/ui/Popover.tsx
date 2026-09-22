import {
  createContext,
  createSignal,
  onCleanup,
  onMount,
  Show,
  splitProps,
  useContext,
  type Accessor,
  type Component,
  type ComponentProps,
  type JSX,
} from 'solid-js';
import { Portal } from 'solid-js/web';
import { cn } from './cn';

interface PopoverContextValue {
  open: Accessor<boolean>;
  setOpen: (open: boolean) => void;
  triggerRef: Accessor<HTMLElement | undefined>;
  setTriggerRef: (el: HTMLElement | undefined) => void;
}

const PopoverContext = createContext<PopoverContextValue>();

function usePopoverContext(): PopoverContextValue {
  const ctx = useContext(PopoverContext);
  if (!ctx) throw new Error('Popover components must be used inside <Popover>');
  return ctx;
}

export interface PopoverProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  children: JSX.Element;
}

/** Popover root — non-modal floating panel anchored to a trigger. */
export const Popover: Component<PopoverProps> = (props) => {
  const [internalOpen, setInternalOpen] = createSignal(props.defaultOpen ?? false);
  const [triggerRef, setTriggerRef] = createSignal<HTMLElement | undefined>();
  const open = () => props.open !== undefined ? props.open : internalOpen();
  const setOpen = (next: boolean) => {
    if (props.open === undefined) setInternalOpen(next);
    props.onOpenChange?.(next);
  };

  return (
    <PopoverContext.Provider value={{ open, setOpen, triggerRef, setTriggerRef }}>
      {props.children}
    </PopoverContext.Provider>
  );
};

export interface PopoverTriggerProps extends ComponentProps<'button'> {}

export const PopoverTrigger: Component<PopoverTriggerProps> = (props) => {
  const ctx = usePopoverContext();
  const [local, rest] = splitProps(props, ['onClick', 'children', 'ref']);
  return (
    <button
      {...rest}
      ref={(el) => {
        ctx.setTriggerRef(el);
        if (typeof local.ref === 'function') local.ref(el);
      }}
      onClick={(e) => {
        ctx.setOpen(!ctx.open());
        if (typeof local.onClick === 'function') {
          (local.onClick as (e: MouseEvent) => void)(e);
        }
      }}
    >
      {local.children}
    </button>
  );
};

export interface PopoverContentProps extends ComponentProps<'div'> {
  /** Offset from the trigger in px. Default 4. */
  offset?: number;
  /** Which side of the trigger to render on. Default 'bottom'. */
  side?: 'top' | 'bottom';
  /** Horizontal alignment relative to the trigger. Default 'start'. */
  align?: 'start' | 'center' | 'end';
}

/**
 * Popover content — positioned via getBoundingClientRect relative to the trigger.
 * No overlay (non-modal). Esc and outside-click close.
 */
export const PopoverContent: Component<PopoverContentProps> = (props) => {
  const ctx = usePopoverContext();
  const [local, rest] = splitProps(props, [
    'class', 'classList', 'children', 'style', 'offset', 'side', 'align', 'ref',
  ]);
  const offset = () => local.offset ?? 4;
  const side = () => local.side ?? 'bottom';
  const align = () => local.align ?? 'start';
  let contentRef: HTMLDivElement | undefined;

  const position = (): JSX.CSSProperties => {
    const trigger = ctx.triggerRef();
    if (!trigger) return { visibility: 'hidden' };
    const rect = trigger.getBoundingClientRect();
    const style: JSX.CSSProperties = { position: 'fixed' };
    if (side() === 'bottom') {
      style.top = `${rect.bottom + offset()}px`;
    } else {
      style.bottom = `${window.innerHeight - rect.top + offset()}px`;
    }
    if (align() === 'start') {
      style.left = `${rect.left}px`;
    } else if (align() === 'center') {
      style.left = `${rect.left + rect.width / 2}px`;
      style.transform = 'translateX(-50%)';
    } else {
      style.right = `${window.innerWidth - rect.right}px`;
    }
    return style;
  };

  const onDocClick = (e: MouseEvent) => {
    const target = e.target as Node | null;
    if (!target) return;
    if (contentRef?.contains(target)) return;
    const trigger = ctx.triggerRef();
    if (trigger?.contains(target)) return;
    ctx.setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      ctx.setOpen(false);
    }
  };

  onMount(() => {
    document.addEventListener('mousedown', onDocClick, true);
    document.addEventListener('keydown', onKeyDown, true);
  });
  onCleanup(() => {
    document.removeEventListener('mousedown', onDocClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
  });

  return (
    <Show when={ctx.open()}>
      <Portal>
        <div
          {...rest}
          ref={(el) => {
            contentRef = el;
            if (typeof local.ref === 'function') local.ref(el);
          }}
          role="dialog"
          class={cn(
            'z-50 w-72 rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-lg',
            'animate-in fade-in-0 zoom-in-95',
            local.class,
          )}
          classList={local.classList}
          style={{ ...position(), ...(typeof local.style === 'object' ? local.style : {}) }}
        >
          {local.children}
        </div>
      </Portal>
    </Show>
  );
};

export interface PopoverCloseProps extends ComponentProps<'button'> {}

/** Close button rendered top-right of the popover content. */
export const PopoverClose: Component<PopoverCloseProps> = (props) => {
  const ctx = usePopoverContext();
  const [local, rest] = splitProps(props, ['class', 'classList', 'onClick', 'children']);
  return (
    <button
      {...rest}
      type="button"
      aria-label="Close"
      class={cn(
        'absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition-colors',
        'hover:bg-secondary hover:text-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        local.class,
      )}
      classList={local.classList}
      onClick={(e) => {
        ctx.setOpen(false);
        if (typeof local.onClick === 'function') {
          (local.onClick as (e: MouseEvent) => void)(e);
        }
      }}
    >
      {local.children ?? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      )}
    </button>
  );
};
