import { Component, createSignal, For, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import styles from './styles.module.css';
import { DocumentToolbar } from './DocumentToolbar';
import type { TabType } from './ViewTabs';
import type { FileType } from '../../types';
import type { ExportFormat } from '../../utils/markdownExport';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '../ui';

export interface DocumentTitleBarProps {
  fileName: string;
  lastModified?: Date;
  fileSize?: number;
  activeTab: TabType;
  outlineCount: number;
  isOutlineOpen: boolean;
  annotationCount?: number;
  isAnnotationColumnOpen?: boolean;
  isFullscreen: boolean;
  fileType?: FileType;
  /** Binary files render a placeholder page; hide all view tabs. */
  binary?: boolean;
  /** Full path (mobile): tapping the filename reveals it. */
  filePath?: string;
  /** Project name shown with the revealed path (mobile). */
  projectName?: string;
  onTabChange: (tab: TabType) => void;
  onOutlineToggle: () => void;
  /** Reading-mode toggle: hide/show all Annotation highlights and markers. */
  annotationsVisible?: boolean;
  onAnnotationsToggle?: () => void;
  /** Independent annotation column toggle (#18). */
  onAnnotationColumnToggle?: () => void;
  onFullscreenToggle: () => void;
  onSearchClick: () => void;
  isSearchActive?: boolean;
  searchDisabled?: boolean;
  searchButtonTitle?: string;
  onCopyClick: () => void;
  onExportClick: (format: ExportFormat) => void;
  isDirty?: boolean;
  /** Render in compact mobile mode (hamburger + filename + actions; views live in the bottom bar). */
  mobile?: boolean;
  /** Click handler for the hamburger menu button shown in mobile mode. */
  onMenuClick?: () => void;
}

const searchIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const copyIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const outlineIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="18" x2="20" y2="18" />
  </svg>
);

const annotationsIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="m9 11-6 6v3h9l3-3" />
    <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
  </svg>
);

const annotationColumnIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const exportIcons: Record<ExportFormat, string> = {
  pdf: '📄',
  html: '🌐',
  md: '📝',
};

export const DocumentTitleBar: Component<DocumentTitleBarProps> = (props) => {
  const [pathOpen, setPathOpen] = createSignal(false);

  const isDocument = () => props.fileType === 'markdown' || props.fileType === 'html';

  /** Export targets by document type: markdown → PDF/HTML/MD source, html → PDF/HTML source. */
  const exportOptions = (): { format: ExportFormat; label: string }[] =>
    props.fileType === 'html'
      ? [
          { format: 'pdf', label: 'Export as PDF' },
          { format: 'html', label: 'Export as HTML source' },
        ]
      : [
          { format: 'pdf', label: 'Export as PDF' },
          { format: 'html', label: 'Export as HTML' },
          { format: 'md', label: 'Export as Markdown source' },
        ];

  // ----- Mobile rendering -----
  if (props.mobile) {
    return (
      <div class={`${styles.documentTitleBar} ${styles.mobileTitleBar} topbar-glass`}>
        <Show when={props.onMenuClick}>
          <button
            class={styles.mobileMenuButton}
            onClick={() => props.onMenuClick?.()}
            title="Menu"
            aria-label="Toggle navigation menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </Show>

        <div class={styles.mobileTitleSection}>
          <button
            type="button"
            class={styles.mobileFileNameButton}
            onClick={() => setPathOpen(!pathOpen())}
            disabled={!props.filePath}
            title={props.filePath ? 'Show full path' : undefined}
            aria-label="Show file path"
            aria-expanded={props.filePath ? pathOpen() : undefined}
          >
            <span class={styles.fileName} data-testid="mobile-topbar-title">{props.fileName}</span>
            <Show when={props.isDirty}>
              <span class={styles.dirtyIndicator} aria-label="unsaved changes">*</span>
            </Show>
          </button>
        </div>

        <Show when={pathOpen() && props.filePath}>
          <Portal>
            <div class={styles.pathPopoverBackdrop} onClick={() => setPathOpen(false)} aria-hidden="true" />
          </Portal>
          <div class={styles.pathPopover} role="dialog" aria-label="File path">
            <Show when={props.projectName}>
              <span class={styles.pathPopoverProject}>{props.projectName}</span>
            </Show>
            <span class={styles.pathPopoverPath}>{props.filePath}</span>
          </div>
        </Show>

        <div class={styles.documentRight}>
          <Menu>
            <MenuTrigger
              class={styles.toolbarButtonIcon}
              title="More actions"
              aria-label="More actions"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="19" cy="12" r="2" />
              </svg>
            </MenuTrigger>
            <MenuContent align="end">
              <MenuItem
                disabled={props.searchDisabled}
                onClick={() => props.onSearchClick()}
              >
                {searchIcon}
                <span>{props.searchButtonTitle || 'Search'}</span>
              </MenuItem>

              <MenuItem onClick={() => props.onCopyClick()}>
                {copyIcon}
                <span>Copy All</span>
              </MenuItem>

              <Show when={isDocument()}>
                <MenuSeparator />
                <For each={exportOptions()}>
                  {(option) => (
                    <MenuItem onClick={() => props.onExportClick(option.format)}>
                      <span>{exportIcons[option.format]}</span>
                      <span>{option.label}</span>
                    </MenuItem>
                  )}
                </For>
              </Show>

              <MenuSeparator />
              <MenuItem onClick={() => props.onOutlineToggle()}>
                {outlineIcon}
                <span>Outline</span>
                <Show when={props.outlineCount > 0}>
                  <span class="ui-menu-badge">{props.outlineCount}</span>
                </Show>
              </MenuItem>

              <Show when={props.fileType === 'markdown' && props.onAnnotationsToggle}>
                <MenuItem onClick={() => props.onAnnotationsToggle?.()}>
                  {annotationsIcon}
                  <span>{props.annotationsVisible === false ? 'Show annotations' : 'Hide annotations'}</span>
                </MenuItem>
              </Show>

              <Show when={props.fileType === 'markdown' && props.onAnnotationColumnToggle}>
                <MenuItem onClick={() => props.onAnnotationColumnToggle?.()}>
                  {annotationColumnIcon}
                  <span>Annotation column</span>
                  <Show when={(props.annotationCount ?? 0) > 0}>
                    <span class="ui-menu-badge">{props.annotationCount}</span>
                  </Show>
                </MenuItem>
              </Show>
            </MenuContent>
          </Menu>
        </div>
      </div>
    );
  }

  // ----- Desktop rendering -----
  return <DocumentToolbar {...props} />;
};
