import { Component, createSignal, For, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import styles from './styles.module.css';
import { ViewTabs } from './ViewTabs';
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
  isAnnotationsOpen?: boolean;
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
  onAnnotationsVisibilityToggle?: () => void;
  onAnnotationsToggle?: () => void;
  onFullscreenToggle: () => void;
  onSearchClick: () => void;
  isSearchActive?: boolean;
  searchDisabled?: boolean;
  searchButtonTitle?: string;
  onCopyClick: () => void;
  onExportClick: (format: ExportFormat) => void;
  isDirty?: boolean;
  onSave?: () => void;
  saving?: boolean;
  /** Render in compact mobile mode (hamburger + filename + actions; views live in the bottom bar). */
  mobile?: boolean;
  /** Click handler for the hamburger menu button shown in mobile mode. */
  onMenuClick?: () => void;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'just now';
  }
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}m ago`;
  }
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h ago`;
  }
  if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days}d ago`;
  }
  return date.toLocaleDateString();
};

const getFileIcon = (fileName: string): string => {
  if (fileName.endsWith('.md') || fileName.endsWith('.mdx')) {
    return '📄';
  }
  if (fileName.endsWith('.html') || fileName.endsWith('.htm')) {
    return '🌐';
  }
  if (fileName.endsWith('.txt')) {
    return '📝';
  }
  if (fileName.endsWith('.json')) {
    return '📋';
  }
  if (fileName.endsWith('.ts') || fileName.endsWith('.tsx') || fileName.endsWith('.js')) {
    return '📜';
  }
  return '📄';
};

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

const exportIcons: Record<ExportFormat, string> = {
  pdf: '📄',
  html: '🌐',
  md: '📝',
};

export const DocumentTitleBar: Component<DocumentTitleBarProps> = (props) => {
  const [pathOpen, setPathOpen] = createSignal(false);
  const formattedSize = () =>
    props.fileSize !== undefined ? formatFileSize(props.fileSize) : '';

  const formattedTime = () =>
    props.lastModified ? formatTimeAgo(props.lastModified) : '';

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

  const exportTriggerIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );

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
          <Show when={props.activeTab === 'edit' && props.onSave}>
            <button
              class={`${styles.toolbarButtonIcon} ${styles.saveButton}`}
              onClick={props.onSave}
              disabled={!props.isDirty || props.saving}
              title="Save (Ctrl+S)"
            >
              <Show when={props.saving} fallback={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                  <polyline points="17 21 17 13 7 13 7 21"/>
                  <polyline points="7 3 7 8 15 8"/>
                </svg>
              }>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class={styles.spinning}>
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
              </Show>
            </button>
          </Show>

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

              <Show when={props.fileType === 'markdown' && props.onAnnotationsVisibilityToggle}>
                <MenuItem onClick={() => props.onAnnotationsVisibilityToggle?.()}>
                  {annotationsIcon}
                  <span>{props.annotationsVisible === false ? 'Show annotations' : 'Hide annotations'}</span>
                </MenuItem>
              </Show>

              <MenuItem onClick={() => props.onAnnotationsToggle?.()}>
                {annotationsIcon}
                <span>Annotations</span>
                <Show when={(props.annotationCount ?? 0) > 0}>
                  <span class="ui-menu-badge">{props.annotationCount}</span>
                </Show>
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </div>
    );
  }

  // ----- Desktop rendering (original) -----
  return (
    <div class={`${styles.documentTitleBar} topbar-glass`}>
      <div class={styles.documentLeft}>
        <div class={styles.documentTitle}>
          <span class={styles.fileIcon}>{getFileIcon(props.fileName)}</span>
          <span class={styles.fileName}>{props.fileName}</span>
        </div>
        <Show when={formattedTime() || formattedSize()}>
          <div class={styles.documentMeta}>
            {formattedTime() && <span>{formattedTime()}</span>}
            {formattedTime() && formattedSize() && <span class={styles.metaSeparator}>•</span>}
            {formattedSize() && <span>{formattedSize()}</span>}
          </div>
        </Show>
      </div>

      <div class={styles.documentCenter}>
        <Show when={!props.binary}>
          <ViewTabs
            activeTab={props.activeTab}
            onTabChange={props.onTabChange}
            fileType={props.fileType}
            isDirty={props.isDirty}
          />
        </Show>
      </div>

      <div class={styles.documentRight}>
        <Show when={props.activeTab === 'edit' && props.onSave}>
          <button
            class={`${styles.toolbarButtonIcon} ${styles.saveButton}`}
            onClick={props.onSave}
            disabled={!props.isDirty || props.saving}
            title="Save (Ctrl+S)"
          >
            <Show when={props.saving} fallback={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
            }>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class={styles.spinning}>
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
              </svg>
            </Show>
          </button>
        </Show>
        <button
          class={`${styles.toolbarButtonIcon} ${props.isSearchActive ? styles.active : ''}`}
          onClick={props.onSearchClick}
          title={props.searchButtonTitle || 'Search'}
          disabled={props.searchDisabled}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </button>

        <button
          class={styles.toolbarButtonIcon}
          onClick={props.onCopyClick}
          title="Copy all"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>

        <Show when={isDocument()}>
          <Menu>
            <MenuTrigger class={styles.toolbarButtonIcon} title="Export">
              {exportTriggerIcon}
            </MenuTrigger>
            <MenuContent align="end">
              <For each={exportOptions()}>
                {(option) => (
                  <MenuItem onClick={() => props.onExportClick(option.format)}>
                    <span>{exportIcons[option.format]}</span>
                    <span>{option.label}</span>
                  </MenuItem>
                )}
              </For>
            </MenuContent>
          </Menu>
        </Show>

        <button
          class={`${styles.toolbarButtonIcon} ${props.isOutlineOpen ? styles.active : ''}`}
          onClick={props.onOutlineToggle}
          title="Outline"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="4" y1="6" x2="20" y2="6"/>
            <line x1="4" y1="12" x2="20" y2="12"/>
            <line x1="4" y1="18" x2="20" y2="18"/>
          </svg>
          <Show when={props.outlineCount > 0}>
            <span class={styles.badge}>{props.outlineCount}</span>
          </Show>
        </button>

        <Show when={props.fileType === 'markdown' && props.onAnnotationsVisibilityToggle}>
          <button
            type="button"
            class={`${styles.toolbarButtonIcon} ${props.annotationsVisible !== false ? styles.active : ''}`}
            onClick={() => props.onAnnotationsVisibilityToggle?.()}
            title={props.annotationsVisible === false ? 'Show annotations' : 'Hide annotations'}
            aria-label={props.annotationsVisible === false ? 'Show annotations' : 'Hide annotations'}
            aria-pressed={props.annotationsVisible !== false}
          >
            {annotationsIcon}
          </button>
        </Show>

        <button
          class={`${styles.toolbarButtonIcon} ${props.isAnnotationsOpen ? styles.active : ''}`}
          onClick={() => props.onAnnotationsToggle?.()}
          title="Annotations"
          aria-label="Annotations"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <Show when={(props.annotationCount ?? 0) > 0}>
            <span class={styles.badge}>{props.annotationCount}</span>
          </Show>
        </button>

        <button
          class={`${styles.toolbarButtonIcon} ${styles.fullscreenButton}`}
          onClick={props.onFullscreenToggle}
          title={props.isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          <Show when={props.isFullscreen} fallback={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
          }>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
            </svg>
          </Show>
        </button>
      </div>
    </div>
  );
};
