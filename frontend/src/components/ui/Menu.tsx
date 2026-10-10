import {
  createContext,
  createEffect,
  onCleanup,
  onMount,
  Show,
  splitProps,
  useContext,
  createSignal,
  type Accessor,
  type Component,
  type ComponentProps,
  type JSX,
} from 'solid-js';
import { Portal } from 'solid-js/web';
import { cn } from './cn';

interface MenuContextValue {
  open: Accessor<boolean>;
  setOpen: (open: boolean) => void;
  triggerRef: Accessor<HTMLElement | undefined>;
  setTriggerRef: (el: HTMLElement | undefined) => void;
}

const MenuContext = createContext<MenuContextValue>();

function useMenuContext(): MenuContextValue {
  const ctx = useContext(MenuContext);
  if (!ctx) throw new Error('Menu components must be used inside <Menu>');
  return ctx;
}

export interface MenuProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  children: JSX.Element;
}

/** Menu root — a non-modal popup menu anchored to a trigger. */
export const Menu: Component<MenuProps> = (props) => {
  const [internalOpen, setInternalOpen] = createSignal(props.defaultOpen ?? false);
  const [triggerRef, setTriggerRef] = createSignal<HTMLElement | undefined>();
  const open = () => (props.open !== undefined ? props.open : internalOpen());
  const setOpen = (next: boolean) => {
    if (props.open === undefined) setInternalOpen(next);
    props.onOpenChange?.(next);
  };

  return (
    <MenuContext.Provider value={{ open, setOpen, triggerRef, setTriggerRef }}>
      {props.children}
    </MenuContext.Provider>
  );
};

export interface MenuTriggerProps extends ComponentProps<'button'> {}

export const MenuTrigger: Component<MenuTriggerProps> = (props) => {
  const ctx = useMenuContext();
  const [local, rest] = splitProps(props, ['onClick', 'children', 'ref']);
  return (
    <button
      {...rest}
      aria-haspopup="menu"
      aria-expanded={ctx.open()}
      ref={(el) => {
        ctx.setTriggerRef(el);
        if (typeof local.ref === 'function') local.ref(el);
      }}
      onClick={(e) => {
        e.stopPropagation();
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

const MENU_GAP = 4;
const VIEWPORT_MARGIN = 8;

export interface MenuContentProps extends ComponentProps<'div'> {
  /** Offset from the trigger in px. Default 4. */
  offset?: number;
  /** Which side of the trigger to render on. Default 'bottom'. */
  side?: 'top' | 'bottom';
  /** Horizontal alignment relative to the trigger. Default 'start'. */
  align?: 'start' | 'end';
}

/**
 * Menu content — portaled to <body>, positioned fixed relative to the trigger
 * and clamped to the viewport (flips above the trigger / shifts horizontally
 * when it would overflow). Esc, outside click, scroll and resize close it.
 */
export const MenuContent: Component<MenuContentProps> = (props) => {
  const ctx = useMenuContext();
  const [local, rest] = splitProps(props, [
    'class', 'classList', 'children', 'style', 'offset', 'side', 'align', 'ref',
  ]);
  const offset = () => local.offset ?? MENU_GAP;
  const side = () => local.side ?? 'bottom';
  const align = () => local.align ?? 'start';
  let contentRef: HTMLDivElement | undefined;

  const [posStyle, setPosStyle] = createSignal<JSX.CSSProperties>({ visibility: 'hidden' });

  /**
   * Measure the rendered menu and compute a fixed left/top that keeps it fully
   * inside the viewport — flipping above the trigger when space runs out below
   * and shifting horizontally when it would overflow either edge.
   */
  const updatePosition = () => {
    const el = contentRef;
    const trigger = ctx.triggerRef();
    if (!el || !trigger) return;
    const triggerRect = trigger.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    const maxHeight = window.innerHeight - VIEWPORT_MARGIN * 2;

    let top: number;
    if (side() === 'top') {
      top = triggerRect.top - offset() - rect.height;
      if (top < VIEWPORT_MARGIN) {
        top = triggerRect.bottom + offset();
      }
    } else {
      top = triggerRect.bottom + offset();
      if (top + rect.height > window.innerHeight - VIEWPORT_MARGIN) {
        const flippedTop = triggerRect.top - offset() - rect.height;
        top = flippedTop >= VIEWPORT_MARGIN ? flippedTop : VIEWPORT_MARGIN;
      }
    }

    let left: number;
    if (align() === 'end') {
      left = triggerRect.right - rect.width;
    } else {
      left = triggerRect.left;
    }
    if (left + rect.width > window.innerWidth - VIEWPORT_MARGIN) {
      left = window.innerWidth - VIEWPORT_MARGIN - rect.width;
    }
    if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;

    const style: JSX.CSSProperties = {
      position: 'fixed',
      left: `${left}px`,
      top: `${top}px`,
    };
    if (rect.height > maxHeight) {
      style['max-height'] = `${maxHeight}px`;
      style['overflow-y'] = 'auto';
    }
    setPosStyle(style);
  };

  createEffect(() => {
    if (ctx.open()) {
      // Render hidden first, then measure and place. Runs after the DOM update.
      setPosStyle({ position: 'fixed', left: '0px', top: '0px', visibility: 'hidden' });
      queueMicrotask(updatePosition);
    }
  });

  const onDocClick = (e: MouseEvent) => {
    const target = e.target as Node | null;
    if (!target) return;
    if (contentRef?.contains(target)) return;
    if (ctx.triggerRef()?.contains(target)) return;
    ctx.setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      ctx.setOpen(false);
    }
  };

  const close = () => ctx.setOpen(false);

  onMount(() => {
    document.addEventListener('mousedown', onDocClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
  });
  onCleanup(() => {
    document.removeEventListener('mousedown', onDocClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('resize', close);
    window.removeEventListener('scroll', close, true);
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
          role="menu"
          class={cn('ui-menu', local.class)}
          classList={local.classList}
          style={{ ...posStyle(), ...(typeof local.style === 'object' ? local.style : {}) }}
        >
          {local.children}
        </div>
      </Portal>
    </Show>
  );
};

export interface MenuItemProps extends ComponentProps<'button'> {
  /** Render in the destructive (danger) color. */
  destructive?: boolean;
}

/** Menu item — closes the menu on click. */
export const MenuItem: Component<MenuItemProps> = (props) => {
  const ctx = useMenuContext();
  const [local, rest] = splitProps(props, [
    'class', 'classList', 'onClick', 'children', 'destructive',
  ]);
  return (
    <button
      {...rest}
      type="button"
      role="menuitem"
      class={cn(
        'ui-menu-item',
        local.destructive && 'ui-menu-item-destructive',
        local.class,
      )}
      classList={local.classList}
      onClick={(e) => {
        if (props.disabled) return;
        if (typeof local.onClick === 'function') {
          (local.onClick as (e: MouseEvent) => void)(e);
        }
        ctx.setOpen(false);
      }}
    >
      {local.children}
    </button>
  );
};

export interface MenuSeparatorProps extends ComponentProps<'div'> {}

export const MenuSeparator: Component<MenuSeparatorProps> = (props) => {
  const [local, rest] = splitProps(props, ['class', 'classList']);
  return (
    <div
      {...rest}
      role="separator"
      class={cn('ui-menu-separator', local.class)}
      classList={local.classList}
    />
  );
};
