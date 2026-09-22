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

interface DialogContextValue {
  open: Accessor<boolean>;
  setOpen: (open: boolean) => void;
}

const DialogContext = createContext<DialogContextValue>();

function useDialogContext(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('Dialog components must be used inside <Dialog>');
  return ctx;
}

export interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  children: JSX.Element;
}

/** Dialog root — holds open state. Controlled via `open`/`onOpenChange`, or uncontrolled via `defaultOpen`. */
export const Dialog: Component<DialogProps> = (props) => {
  const [internalOpen, setInternalOpen] = createSignal(props.defaultOpen ?? false);
  const open = () => props.open !== undefined ? props.open : internalOpen();
  const setOpen = (next: boolean) => {
    if (props.open === undefined) setInternalOpen(next);
    props.onOpenChange?.(next);
  };

  return (
    <DialogContext.Provider value={{ open, setOpen }}>
      {props.children}
    </DialogContext.Provider>
  );
};

export interface DialogTriggerProps extends ComponentProps<'button'> {}

export const DialogTrigger: Component<DialogTriggerProps> = (props) => {
  const ctx = useDialogContext();
  const [local, rest] = splitProps(props, ['onClick', 'children']);
  return (
    <button
      {...rest}
      onClick={(e) => {
        ctx.setOpen(true);
        if (typeof local.onClick === 'function') {
          (local.onClick as (e: MouseEvent) => void)(e);
        }
      }}
    >
      {local.children}
    </button>
  );
};

export interface DialogOverlayProps extends ComponentProps<'div'> {}

/** Backdrop — bg-black/50 backdrop-blur-sm, click-outside closes. Only rendered while open. */
export const DialogOverlay: Component<DialogOverlayProps> = (props) => {
  const ctx = useDialogContext();
  const [local, rest] = splitProps(props, ['class', 'classList', 'onClick']);
  return (
    <div
      {...rest}
      data-dialog-overlay
      class={cn('fixed inset-0 z-50 bg-black/50 backdrop-blur-sm', local.class)}
      classList={local.classList}
      onClick={(e) => {
        ctx.setOpen(false);
        if (typeof local.onClick === 'function') {
          (local.onClick as (e: MouseEvent) => void)(e);
        }
      }}
    />
  );
};

export interface DialogContentProps extends ComponentProps<'div'> {
  /** Called when the user requests close (Esc / overlay click / close button). */
  onClose?: () => void;
}

/**
 * Dialog content — white card with border, rounded-lg, shadow-lg, scaleIn animation.
 * Esc closes; outside clicks (on the overlay) close via DialogOverlay.
 * Keeps a simple focus trap: on open focuses the first focusable element,
 * Tab cycles within the content.
 */
export const DialogContent: Component<DialogContentProps> = (props) => {
  const ctx = useDialogContext();
  const [local, rest] = splitProps(props, ['class', 'classList', 'children', 'onClose', 'onKeyDown']);
  let contentRef: HTMLDivElement | undefined;

  const close = () => {
    ctx.setOpen(false);
    local.onClose?.();
  };

  const focusable = () => {
    if (!contentRef) return [] as HTMLElement[];
    return Array.from(
      contentRef.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (typeof local.onKeyDown === 'function') {
      (local.onKeyDown as (e: KeyboardEvent) => void)(e);
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'Tab') {
      const items = focusable();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (!active || active === first || !contentRef!.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (!active || active === last || !contentRef!.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };

  onMount(() => {
    // Focus the first focusable element (or the dialog itself) once mounted.
    requestAnimationFrame(() => {
      const items = focusable();
      (items[0] ?? contentRef)?.focus();
    });
  });

  onCleanup(() => {
    // No global listeners — keydown is attached to the content div itself.
  });

  return (
    <Show when={ctx.open()}>
      <Portal>
        <DialogOverlay class="dialog-overlay" />
        <div
          {...rest}
          ref={(el) => (contentRef = el)}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          class={cn(
            'fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2',
            'rounded-lg border border-border bg-background p-6 shadow-lg',
            'animate-in fade-in-0 zoom-in-95',
            'outline-none',
            local.class,
          )}
          classList={local.classList}
          onKeyDown={onKeyDown}
          onClick={(e) => e.stopPropagation()}
        >
          {local.children}
        </div>
      </Portal>
    </Show>
  );
};

export interface DialogHeaderProps extends ComponentProps<'div'> {}

export const DialogHeader: Component<DialogHeaderProps> = (props) => {
  const [local, rest] = splitProps(props, ['class', 'classList']);
  return (
    <div
      {...rest}
      class={cn('flex flex-col space-y-1.5 text-center sm:text-left', local.class)}
      classList={local.classList}
    />
  );
};

export interface DialogFooterProps extends ComponentProps<'div'> {}

export const DialogFooter: Component<DialogFooterProps> = (props) => {
  const [local, rest] = splitProps(props, ['class', 'classList']);
  return (
    <div
      {...rest}
      class={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', local.class)}
      classList={local.classList}
    />
  );
};

export interface DialogTitleProps extends ComponentProps<'h2'> {}

export const DialogTitle: Component<DialogTitleProps> = (props) => {
  const [local, rest] = splitProps(props, ['class', 'classList']);
  return (
    <h2
      {...rest}
      class={cn('text-lg font-semibold leading-none tracking-tight text-foreground', local.class)}
      classList={local.classList}
    />
  );
};

export interface DialogDescriptionProps extends ComponentProps<'p'> {}

export const DialogDescription: Component<DialogDescriptionProps> = (props) => {
  const [local, rest] = splitProps(props, ['class', 'classList']);
  return (
    <p {...rest} class={cn('text-sm text-muted-foreground', local.class)} classList={local.classList} />
  );
};

export interface DialogCloseProps extends ComponentProps<'button'> {}

/** Close button — an × rendered top-right of the dialog content. */
export const DialogClose: Component<DialogCloseProps> = (props) => {
  const ctx = useDialogContext();
  const [local, rest] = splitProps(props, ['class', 'classList', 'onClick', 'children']);
  return (
    <button
      {...rest}
      type="button"
      aria-label="Close"
      class={cn(
        'absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition-colors',
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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      )}
    </button>
  );
};
