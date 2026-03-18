import { Component, createSignal, Show, onMount, onCleanup } from 'solid-js';
import styles from './styles.module.css';

export interface DropdownProps {
  trigger: 'click' | 'hover';
  content: () => JSX.Element;
  children: JSX.Element;
}

import type { JSX } from 'solid-js';

export const Dropdown: Component<DropdownProps> = (props) => {
  const [isOpen, setIsOpen] = createSignal(false);
  let dropdownRef: HTMLDivElement | undefined;

  const handleClickOutside = (e: MouseEvent) => {
    if (dropdownRef && !dropdownRef.contains(e.target as Node)) {
      setIsOpen(false);
    }
  };

  onMount(() => {
    document.addEventListener('click', handleClickOutside);
  });

  onCleanup(() => {
    document.removeEventListener('click', handleClickOutside);
  });

  const handleTrigger = () => {
    if (props.trigger === 'click') {
      setIsOpen(!isOpen());
    }
  };

  return (
    <div
      ref={dropdownRef}
      class={styles.dropdown}
      onMouseEnter={() => props.trigger === 'hover' && setIsOpen(true)}
      onMouseLeave={() => props.trigger === 'hover' && setIsOpen(false)}
    >
      <div onClick={handleTrigger}>{props.children}</div>
      <Show when={isOpen()}>
        <div class={styles.dropdownMenu}>{props.content()}</div>
      </Show>
    </div>
  );
};
