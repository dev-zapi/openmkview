import { Component, Show, createSignal, createEffect, onCleanup } from 'solid-js';
import styles from './styles.module.css';

export interface ExportDropdownProps {
  onExport: (format: 'pdf' | 'html' | 'md') => void;
}

export const ExportDropdown: Component<ExportDropdownProps> = (props) => {
  const [isOpen, setIsOpen] = createSignal(false);
  let dropdownRef: HTMLDivElement | undefined;

  const handleClickOutside = (e: MouseEvent) => {
    if (dropdownRef && !dropdownRef.contains(e.target as Node)) {
      setIsOpen(false);
    }
  };

  createEffect(() => {
    if (isOpen()) {
      document.addEventListener('click', handleClickOutside);
    } else {
      document.removeEventListener('click', handleClickOutside);
    }
  });

  onCleanup(() => {
    document.removeEventListener('click', handleClickOutside);
  });

  const handleExport = (format: 'pdf' | 'html' | 'md') => {
    props.onExport(format);
    setIsOpen(false);
  };

  return (
    <div class={styles.dropdown} ref={dropdownRef}>
      <button
        class={styles.toolbarButton}
        onClick={() => setIsOpen(!isOpen())}
        title="导出"
      >
        ⬇️ 导出
      </button>
      <Show when={isOpen()}>
        <div class={styles.dropdownMenu}>
          <button
            class={styles.dropdownItem}
            onClick={() => handleExport('pdf')}
          >
            📄 导出为 PDF
          </button>
          <button
            class={styles.dropdownItem}
            onClick={() => handleExport('html')}
          >
            🌐 导出为 HTML
          </button>
          <button
            class={styles.dropdownItem}
            onClick={() => handleExport('md')}
          >
            📝 导出为 Markdown
          </button>
        </div>
      </Show>
    </div>
  );
};
