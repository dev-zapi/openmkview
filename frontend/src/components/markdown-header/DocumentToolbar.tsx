import { Component, For, Show, type JSX } from 'solid-js';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../ui';
import { ViewTabs, type TabType } from './ViewTabs';
import type { FileType } from '../../types';
import type { ExportFormat } from '../../utils/markdownExport';
import styles from './DocumentToolbar.module.css';

export interface DocumentToolbarProps {
  fileName: string;
  lastModified?: Date;
  fileSize?: number;
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  fileType?: FileType;
  binary?: boolean;
  isDirty?: boolean;
  outlineCount: number;
  isOutlineOpen: boolean;
  onOutlineToggle: () => void;
  annotationCount?: number;
  isAnnotationColumnOpen?: boolean;
  onAnnotationColumnToggle?: () => void;
  annotationsVisible?: boolean;
  onAnnotationsToggle?: () => void;
  isFullscreen: boolean;
  onFullscreenToggle: () => void;
  onSearchClick: () => void;
  isSearchActive?: boolean;
  searchDisabled?: boolean;
  searchButtonTitle?: string;
  onCopyClick: () => void;
  onExportClick: (format: ExportFormat) => void;
}

type IconName =
  | 'file'
  | 'search'
  | 'copy'
  | 'export'
  | 'outline'
  | 'pen'
  | 'comments'
  | 'expand'
  | 'collapse'
  | 'code';

const paths: Record<IconName, JSX.Element> = {
  file: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6M8 13h8M8 17h5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
  export: (
    <>
      <path d="M12 3v12m-4-4 4 4 4-4M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
    </>
  ),
  outline: (
    <>
      <path d="M4 5h16M4 12h10M4 19h16" />
      <path d="M18 10v4" />
    </>
  ),
  pen: (
    <>
      <path d="m15 5 4 4M4 20l4-1 11-11a2.8 2.8 0 0 0-4-4L4 15Z" />
      <path d="m13 6 4 4" />
    </>
  ),
  comments: (
    <>
      <path d="M20 15a3 3 0 0 1-3 3H9l-5 3V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3Z" />
      <path d="M8 9h8M8 13h5" />
    </>
  ),
  expand: <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />,
  collapse: <path d="M3 8h5V3m8 0v5h5M8 21v-5H3m18 0h-5v5" />,
  code: <path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-14-2 16" />,
};

const Icon: Component<{ name: IconName; size?: number }> = (p) => (
  <svg
    width={p.size ?? 16}
    height={p.size ?? 16}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.65"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    {paths[p.name]}
  </svg>
);


const meta = (p: DocumentToolbarProps) =>
  [
    p.fileSize !== undefined ? `${(p.fileSize / 1024).toFixed(1)} KB` : '',
    p.lastModified
      ? `Modified ${p.lastModified.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : '',
  ]
    .filter(Boolean)
    .join(' · ');

const exportOptions = (fileType?: FileType): { format: ExportFormat; label: string }[] =>
  fileType === 'html'
    ? [
        { format: 'pdf', label: 'Export as PDF' },
        { format: 'html', label: 'Export as HTML source' },
      ]
    : [
        { format: 'pdf', label: 'Export as PDF' },
        { format: 'html', label: 'Export as HTML' },
        { format: 'md', label: 'Export as Markdown source' },
      ];

export const DocumentToolbar: Component<DocumentToolbarProps> = (props) => {
  return (
    <div class={styles.toolbar} data-document-toolbar>
      <div class={styles.identity}>
        <Icon name="file" size={17} />
        <span class={styles.filename}>{props.fileName}</span>
        <span class={styles.meta}>{meta(props)}</span>
      </div>

      <ViewTabs
        activeTab={props.activeTab}
        onTabChange={props.onTabChange}
        fileType={props.fileType}
        binary={props.binary}
        isDirty={props.isDirty}
      />

      <div class={styles.actionCluster}>
        <div class={styles.actions}>
          <button
            class={`${styles.icon} ${props.isSearchActive ? styles.selected : ''}`}
            onClick={props.onSearchClick}
            disabled={props.searchDisabled}
            title={props.searchButtonTitle || 'Search'}
            aria-label={props.searchButtonTitle || 'Search'}
            aria-pressed={props.isSearchActive}
          >
            <Icon name="search" />
          </button>
          <button
            class={styles.icon}
            onClick={props.onCopyClick}
            title="Copy entire document"
            aria-label="Copy entire document"
          >
            <Icon name="copy" />
          </button>
          <Show when={props.fileType === 'markdown' || props.fileType === 'html'}>
            <Menu>
              <MenuTrigger
                class={styles.icon}
                title="Export document"
                aria-label="Export document"
              >
                <Icon name="export" />
              </MenuTrigger>
              <MenuContent align="end">
                <For each={exportOptions(props.fileType)}>
                  {(option) => (
                    <MenuItem onClick={() => props.onExportClick(option.format)}>
                      <Icon name={option.format === 'md' ? 'code' : 'file'} />
                      {option.label}
                    </MenuItem>
                  )}
                </For>
              </MenuContent>
            </Menu>
          </Show>
        </div>

        <span class={styles.rule} />

        <div class={styles.actions}>
          <button
            class={`${styles.icon} ${props.isOutlineOpen ? styles.selected : ''}`}
            onClick={props.onOutlineToggle}
            title="Document outline"
            aria-label="Document outline"
            aria-pressed={props.isOutlineOpen}
          >
            <Icon name="outline" />
            <Show when={props.outlineCount > 0}>
              <span class={styles.count}>{props.outlineCount}</span>
            </Show>
          </button>

          <Show when={props.fileType === 'markdown' && props.onAnnotationsToggle}>
            <button
              class={`${styles.icon} ${props.annotationsVisible !== false ? styles.selected : ''}`}
              onClick={props.onAnnotationsToggle}
              title={props.annotationsVisible === false ? 'Show annotation highlights' : 'Hide annotation highlights'}
              aria-label={props.annotationsVisible === false ? 'Show annotation highlights' : 'Hide annotation highlights'}
              aria-pressed={props.annotationsVisible !== false}
            >
              <Icon name="pen" />
            </button>
          </Show>

          <button
            class={`${styles.icon} ${props.isAnnotationColumnOpen ? styles.selected : ''}`}
            onClick={props.onAnnotationColumnToggle}
            title="Annotation column"
            aria-label="Annotation column"
            aria-pressed={props.isAnnotationColumnOpen}
          >
            <Icon name="comments" />
            <Show when={(props.annotationCount ?? 0) > 0}>
              <span class={styles.count}>{props.annotationCount}</span>
            </Show>
          </button>
        </div>

        <span class={styles.rule} />

        <button
          class={styles.icon}
          onClick={props.onFullscreenToggle}
          title={props.isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          aria-label={props.isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          <Icon name={props.isFullscreen ? 'collapse' : 'expand'} />
        </button>
      </div>
    </div>
  );
};
