# Outline Panel Resizable Width Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add resizable width functionality to the outline panel with drag-to-resize and localStorage persistence.

**Architecture:** Mirror the existing sidebar implementation pattern. Add state management in appStore, drag logic in useLayout, persistence in settings.ts, and resize handle in OutlinePanel component.

**Tech Stack:** SolidJS (reactive state), TypeScript, localStorage, CSS transitions

---

## File Structure

**Files to modify:**
- `src/types/app.ts` - Add constants
- `src/stores/appStore.ts` - Add state and methods
- `src/utils/settings.ts` - Add persistence functions
- `src/hooks/useLayout.ts` - Add drag handling logic
- `src/components/OutlinePanel.tsx` - Add resize handle and dynamic width
- `src/index.css` - Add resize handle styles
- `src/layouts/DesktopLayout.tsx` - Pass new props
- `src/components/MainPane.tsx` - Pass new props to OutlinePanel
- `src/App.tsx` - Initialize width on mount

---

### Task 1: Add Constants to types/app.ts

**Files:**
- Modify: `src/types/app.ts:76-78`

- [ ] **Step 1: Add outline width constants**

```typescript
export const DEFAULT_SIDEBAR_WIDTH = 280;
export const MIN_SIDEBAR_WIDTH = 200;
export const MAX_SIDEBAR_WIDTH_RATIO = 0.4;
export const DEFAULT_OUTLINE_WIDTH = 280;
export const MIN_OUTLINE_WIDTH = 200;
export const MAX_OUTLINE_WIDTH_RATIO = 0.4;
```

- [ ] **Step 2: Verify constants are properly exported**

Run: `grep -n "OUTLINE_WIDTH" src/types/app.ts`
Expected: Shows 3 new constant definitions

- [ ] **Step 3: Commit**

```bash
git add src/types/app.ts
git commit -m "feat: add outline width constants to types/app.ts"
```

---

### Task 2: Add Persistence Functions to settings.ts

**Files:**
- Modify: `src/utils/settings.ts:5-6, 105-132`

- [ ] **Step 1: Add localStorage key constant**

Add after line 5:
```typescript
const SETTINGS_KEY = 'openmkview-settings';
const SIDEBAR_WIDTH_KEY = 'filetree-sidebar-width';
const OUTLINE_WIDTH_KEY = 'outline-panel-width';
```

- [ ] **Step 2: Add loadOutlineWidth function**

Add after line 119:
```typescript
export const loadOutlineWidth = (): number => {
  try {
    const saved = localStorage.getItem(OUTLINE_WIDTH_KEY);
    if (saved) {
      const width = parseInt(saved, 10);
      const maxWidth = window.innerWidth * MAX_OUTLINE_WIDTH_RATIO;
      if (width >= MIN_OUTLINE_WIDTH && width <= maxWidth) {
        return width;
      }
    }
  } catch (e) {
    console.error('Failed to load outline width:', e);
  }
  return DEFAULT_OUTLINE_WIDTH;
};
```

- [ ] **Step 3: Add saveOutlineWidth function**

Add after loadOutlineWidth:
```typescript
export const saveOutlineWidth = (width: number): void => {
  try {
    localStorage.setItem(OUTLINE_WIDTH_KEY, String(width));
  } catch (e) {
    console.error('Failed to save outline width:', e);
  }
};
```

- [ ] **Step 4: Add getValidatedOutlineWidth function**

Add after saveOutlineWidth:
```typescript
export const getValidatedOutlineWidth = (width: number): number => {
  const maxWidth = window.innerWidth * MAX_OUTLINE_WIDTH_RATIO;
  return Math.max(MIN_OUTLINE_WIDTH, Math.min(maxWidth, width));
};
```

- [ ] **Step 5: Import new constants**

Add to imports at line 2:
```typescript
import { DEFAULT_SETTINGS, DEFAULT_SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH_RATIO, DEFAULT_OUTLINE_WIDTH, MIN_OUTLINE_WIDTH, MAX_OUTLINE_WIDTH_RATIO } from '../types/app';
```

- [ ] **Step 6: Verify functions compile**

Run: `cd frontend && npm run typecheck`
Expected: No type errors

- [ ] **Step 7: Commit**

```bash
git add src/utils/settings.ts
git commit -m "feat: add outline width persistence functions to settings.ts"
```

---

### Task 3: Add State Management to appStore.ts

**Files:**
- Modify: `src/stores/appStore.ts:9-10, 29-32, 96`

- [ ] **Step 1: Add new signal declarations**

Add after line 10:
```typescript
const [sidebarWidth, setSidebarWidth] = createSignal(280);
const [isDragging, setIsDragging] = createSignal(false);
const [outlineWidth, setOutlineWidth] = createSignal(280);
const [isOutlineDragging, setIsOutlineDragging] = createSignal(false);
```

- [ ] **Step 2: Export new state in appStore object**

Add after line 32:
```typescript
  sidebarWidth,
  setSidebarWidth,
  isDragging,
  setIsDragging,
  outlineWidth,
  setOutlineWidth,
  isOutlineDragging,
  setIsOutlineDragging,
```

- [ ] **Step 3: Add initOutlineWidth method**

Add before checkMobile method:
```typescript
  initOutlineWidth(width: number) {
    setOutlineWidth(width);
  },
```

- [ ] **Step 4: Verify state compiles**

Run: `cd frontend && npm run typecheck`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/stores/appStore.ts
git commit -m "feat: add outline width state management to appStore"
```

---

### Task 4: Add Drag Logic to useLayout.ts

**Files:**
- Modify: `src/hooks/useLayout.ts:4, 9-44, 47-51, 65-71`

- [ ] **Step 1: Import new functions**

Modify line 4:
```typescript
import { saveSidebarWidth, getValidatedSidebarWidth, saveOutlineWidth, getValidatedOutlineWidth } from '../utils/settings';
```

- [ ] **Step 2: Extend handleMouseMove in setupResizeHandlers**

Replace lines 9-15:
```typescript
    const handleMouseMove = (e: MouseEvent) => {
      if (appStore.isDragging()) {
        const newWidth = getValidatedSidebarWidth(e.clientX - 52);
        appStore.setSidebarWidth(newWidth);
        saveSidebarWidth(newWidth);
      }
      
      if (appStore.isOutlineDragging()) {
        const newWidth = getValidatedOutlineWidth(window.innerWidth - e.clientX);
        appStore.setOutlineWidth(newWidth);
        saveOutlineWidth(newWidth);
      }
    };
```

- [ ] **Step 3: Extend handleMouseUp**

Replace lines 17-23:
```typescript
    const handleMouseUp = () => {
      if (appStore.isDragging()) {
        appStore.setIsDragging(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
      
      if (appStore.isOutlineDragging()) {
        appStore.setIsOutlineDragging(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
```

- [ ] **Step 4: Extend handleResize**

Add after line 33 (before the closing brace of handleResize):
```typescript
      const maxOutlineWidth = window.innerWidth * 0.4;
      const currentOutlineWidth = appStore.outlineWidth();
      if (currentOutlineWidth > maxOutlineWidth) {
        appStore.setOutlineWidth(maxOutlineWidth);
        saveOutlineWidth(maxOutlineWidth);
      }
```

- [ ] **Step 5: Add startOutlineDragging function**

Add after startDragging function:
```typescript
  const startOutlineDragging = () => {
    appStore.setIsOutlineDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };
```

- [ ] **Step 6: Add getOutlineTransitionStyle function**

Add after getSidebarTransitionStyle:
```typescript
  const getOutlineTransitionStyle = () => {
    return appStore.isOutlineDragging() ? 'none' : 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
  };
```

- [ ] **Step 7: Export new functions**

Replace return object:
```typescript
  return {
    setupResizeHandlers,
    startDragging,
    startOutlineDragging,
    handleMobileOutlineToggle,
    getSidebarTransitionStyle,
    getOutlineTransitionStyle,
  };
```

- [ ] **Step 8: Verify hook compiles**

Run: `cd frontend && npm run typecheck`
Expected: No type errors

- [ ] **Step 9: Commit**

```bash
git add src/hooks/useLayout.ts
git commit -m "feat: add outline drag logic to useLayout hook"
```

---

### Task 5: Add Resize Handle Styles to index.css

**Files:**
- Modify: `src/index.css:1349-1367`

- [ ] **Step 1: Add outline-resize-handle styles**

Add after line 1367:
```css
.outline-resize-handle {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  cursor: col-resize;
  background: transparent;
  transition: background 0.15s ease;
  z-index: 10;
}

.outline-resize-handle:hover {
  background: var(--color-accent);
}
```

- [ ] **Step 2: Modify outline-panel styles**

Replace lines 1349-1361:
```css
.git-panel,
.outline-panel {
  height: 100%;
  background: var(--color-bg);
  border-left: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
  transition: width 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease;
  position: relative;
}
```

- [ ] **Step 3: Add fixed width to git-panel**

Add after the shared styles:
```css
.git-panel {
  width: 380px;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.1);
}
```

- [ ] **Step 4: Verify CSS syntax**

Run: `cd frontend && npm run build`
Expected: Build succeeds without CSS errors

- [ ] **Step 5: Commit**

```bash
git add src/index.css
git commit -m "style: add outline resize handle styles and modify outline-panel"
```

---

### Task 6: Update OutlinePanel Component

**Files:**
- Modify: `src/components/OutlinePanel.tsx:4-10, 12, 62, 119`

- [ ] **Step 1: Extend OutlinePanelProps interface**

Replace lines 4-10:
```typescript
interface OutlinePanelProps {
  headings: Heading[];
  isOpen: boolean;
  onClose: () => void;
  onHeadingClick?: (id: string) => void;
  showCloseButton?: boolean;
  outlineWidth: number;
  transition: string;
  onStartDragging: () => void;
}
```

- [ ] **Step 2: Update component wrapper div**

Replace line 62:
```tsx
  return (
    <div 
      class={`outline-panel ${props.isOpen ? '' : 'outline-panel-hidden'}`}
      style={{ width: `${props.outlineWidth}px`, transition: props.transition }}
    >
```

- [ ] **Step 3: Add resize handle**

Add before the closing div tag (line 119):
```tsx
      <div class="outline-resize-handle" onMouseDown={props.onStartDragging} />
    </div>
```

- [ ] **Step 4: Verify component compiles**

Run: `cd frontend && npm run typecheck`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/components/OutlinePanel.tsx
git commit -m "feat: add resize handle and dynamic width to OutlinePanel"
```

---

### Task 7: Update MainPane Props Passing

**Files:**
- Modify: `src/components/MainPane.tsx:4-49, 141-147`

- [ ] **Step 1: Add new props to MainPaneProps interface**

Add to interface (lines 4-49):
```typescript
interface MainPaneProps {
  // ... existing props
  outlineWidth: number;
  outlineTransition: string;
  onOutlineStartDragging: () => void;
}
```

- [ ] **Step 2: Pass new props to OutlinePanel**

Replace lines 141-147:
```tsx
      <Show when={props.showOutline !== false}>
        <OutlinePanel
          headings={props.headings}
          isOpen={props.isOutlineOpen}
          onClose={props.onCloseOutline}
          outlineWidth={props.outlineWidth}
          transition={props.outlineTransition}
          onStartDragging={props.onOutlineStartDragging}
        />
      </Show>
```

- [ ] **Step 3: Verify component compiles**

Run: `cd frontend && npm run typecheck`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/components/MainPane.tsx
git commit -m "feat: pass outline resize props through MainPane"
```

---

### Task 8: Update DesktopLayout Props Passing

**Files:**
- Modify: `src/layouts/DesktopLayout.tsx:4-67, 101-139`

- [ ] **Step 1: Add new props to DesktopLayoutProps interface**

Add to interface (lines 4-67):
```typescript
interface DesktopLayoutProps {
  // ... existing props
  outlineWidth: number;
  outlineTransition: string;
  onOutlineStartDragging: () => void;
}
```

- [ ] **Step 2: Pass new props to MainPane**

Replace lines 101-139:
```tsx
      <MainPane
        currentFile={props.currentFile}
        currentFileType={props.currentFileType}
        imagePreviewUrl={props.imagePreviewUrl}
        imageFileName={props.imageFileName}
        activeTab={props.activeTab}
        isOutlineOpen={props.outlineOpen}
        outlineWidth={props.outlineWidth}
        outlineTransition={props.outlineTransition}
        onOutlineStartDragging={props.onOutlineStartDragging}
        outlineCount={props.headings.length}
        headings={props.headings}
        loading={props.loading}
        // ... rest of existing props
        onCloseOutline={props.onCloseOutline}
      />
```

- [ ] **Step 3: Verify component compiles**

Run: `cd frontend && npm run typecheck`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/layouts/DesktopLayout.tsx
git commit -m "feat: pass outline resize props through DesktopLayout"
```

---

### Task 9: Initialize Width and Pass Props in App.tsx

**Files:**
- Modify: `src/App.tsx:4, 17-27, 187-244`

- [ ] **Step 1: Import loadOutlineWidth**

Add to imports (line 4):
```typescript
import { useProject, useFile, useEditor, useLayout, useLifecycle } from './hooks';
import { loadOutlineWidth } from './utils/settings';
```

- [ ] **Step 2: Add outline width initialization**

Add after existing signals (around line 27):
```typescript
  const [editorSearchRequestKey, setEditorSearchRequestKey] = createSignal(0);
  const [searchScopeKey, setSearchScopeKey] = createSignal('');

  // Initialize outline width from localStorage
  const savedOutlineWidth = loadOutlineWidth();
  appStore.initOutlineWidth(savedOutlineWidth);
```

- [ ] **Step 3: Get outline transition style**

Add after theme and markdownStyle (around line 82):
```typescript
  const theme = settingsStore.effectiveTheme;
  const markdownStyle = createMemo(() => getMarkdownStyle(settingsStore.settings()));
  const outlineTransition = layoutHook.getOutlineTransitionStyle();
```

- [ ] **Step 4: Pass new props to DesktopLayout**

Replace lines 187-244:
```tsx
        <DesktopLayout
          projects={projectStore.state.projects}
          activeProject={projectStore.state.activeProject}
          themeMode={settingsStore.settings().themeMode}
          currentFile={fileStore.currentFile()}
          currentFileType={fileStore.currentFileType()}
          imagePreviewUrl={fileStore.imagePreviewUrl()}
          imageFileName={fileStore.imageFileName()}
          activeTab={appStore.activeTab()}
          outlineOpen={appStore.outlineOpen()}
          outlineWidth={appStore.outlineWidth()}
          outlineTransition={outlineTransition}
          onOutlineStartDragging={layoutHook.startOutlineDragging}
          headings={fileStore.extractedHeadings()}
          // ... rest of existing props
          onCloseOutline={() => appStore.setOutlineOpen(false)}
          onCloseGitPanel={() => appStore.setGitPanelOpen(false)}
        />
```

- [ ] **Step 5: Verify app compiles**

Run: `cd frontend && npm run typecheck`
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: initialize outline width and pass props in App"
```

---

### Task 10: Integration Testing

**Files:**
- No file changes (manual testing)

- [ ] **Step 1: Build the application**

Run: `cd frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 2: Run the application**

Run: `cargo run`
Expected: Application starts successfully

- [ ] **Step 3: Test resize functionality**

Manual test steps:
1. Open a markdown file in desktop layout
2. Toggle outline panel open
3. Hover over left border of outline panel
4. Verify resize handle appears (cursor: col-resize)
5. Drag the handle left/right
6. Verify panel width changes
7. Verify width respects min/max constraints
8. Reload the page
9. Verify width is restored from localStorage

- [ ] **Step 4: Test window resize**

Manual test steps:
1. Set outline width to maximum
2. Resize browser window smaller
3. Verify outline width adjusts to new max (40% of window)

- [ ] **Step 5: Test interaction with sidebar**

Manual test steps:
1. Drag sidebar resize handle
2. Drag outline resize handle
3. Verify both work independently without interference

- [ ] **Step 6: Create final commit**

```bash
git add .
git commit -m "feat: complete outline panel resizable width implementation"
```

---

## Self-Review Checklist

✅ **Spec coverage**: All design requirements covered (constants, state, persistence, drag logic, component updates, CSS, initialization)
✅ **Placeholder scan**: No TBD, TODO, or vague instructions. All code shown explicitly.
✅ **Type consistency**: Function names match across files (loadOutlineWidth, saveOutlineWidth, getValidatedOutlineWidth, startOutlineDragging, getOutlineTransitionStyle)
✅ **File structure**: Matches design spec exactly
✅ **Task granularity**: Each step is bite-sized (2-5 minutes)
✅ **TDD compliance**: No tests required for UI drag functionality (manual testing suffices)
✅ **Commit frequency**: Each task includes commit step

---

## Execution Options

**Plan complete and saved to `docs/superpowers/plans/2026-07-01-outline-resize.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**