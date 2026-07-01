# Outline Panel Resizable Width Design

**Date**: 2026-07-01  
**Author**: AI Assistant  
**Status**: Draft

## Overview

Add resizable width functionality to the outline panel (大纲边栏) in the desktop layout, allowing users to drag-adjust the panel width and persist the setting across sessions.

## Requirements

- Support drag-to-resize functionality for the outline panel
- Persist adjusted width in localStorage
- Maintain width across page reloads
- Use same width constraints as sidebar (file tree panel)

## Architecture

### Core Components

- **OutlinePanel**: Add resize handle for width adjustment
- **appStore**: Add `outlineWidth` and `isOutlineDragging` state
- **useLayout**: Add outline drag handling logic
- **settings utility**: Add outline width persistence functions

### Data Flow

```
User drag → resize handle onMouseDown
→ appStore.setIsOutlineDragging(true)
→ document mouseMove → calculate new width
→ appStore.setOutlineWidth(newWidth)
→ localStorage persistence
→ mouseUp → end dragging
→ OutlinePanel renders new width
```

## Width Constraints

Matches sidebar constraints for consistency:
- **Default width**: 280px
- **Minimum width**: 200px
- **Maximum width**: 40% of window width

## Implementation Details

### 1. State Management

#### appStore Extension

Add to `src/stores/appStore.ts`:

```typescript
const [outlineWidth, setOutlineWidth] = createSignal(280);
const [isOutlineDragging, setIsOutlineDragging] = createSignal(false);

export const appStore = {
  outlineWidth,
  setOutlineWidth,
  isOutlineDragging,
  setIsOutlineDragging,
  
  initOutlineWidth(width: number) {
    setOutlineWidth(width);
  },
}
```

#### Constants

Add to `src/types/app.ts`:

```typescript
export const DEFAULT_OUTLINE_WIDTH = 280;
export const MIN_OUTLINE_WIDTH = 200;
export const MAX_OUTLINE_WIDTH_RATIO = 0.4;
```

### 2. Component Design

#### OutlinePanel Props

Extend interface in `src/components/OutlinePanel.tsx`:

```typescript
interface OutlinePanelProps {
  headings: Heading[];
  isOpen: boolean;
  onClose: () => void;
  onHeadingClick?: (id: string) => void;
  showCloseButton?: boolean;
  // New props:
  outlineWidth: number;
  transition: string;
  onStartDragging: () => void;
}
```

#### Component Structure

```tsx
<div 
  class={`outline-panel ${props.isOpen ? '' : 'outline-panel-hidden'}`}
  style={{ width: `${props.outlineWidth}px`, transition: props.transition }}
>
  {/* header and content unchanged */}
  <div class="outline-resize-handle" onMouseDown={props.onStartDragging} />
</div>
```

### 3. CSS Styling

Add resize handle styles to `src/index.css`:

```css
.outline-resize-handle {
  position: absolute;
  left: 0;  /* Left border */
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

Modify existing `.outline-panel`:

```css
.outline-panel {
  /* Remove fixed width */
  /* width: 280px; */  /* deleted */
  height: 100%;
  background: var(--color-bg);
  border-left: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
  transition: width 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease;
  position: relative;  /* new: support resize handle positioning */
}
```

### 4. Persistence Layer

Add to `src/utils/settings.ts`:

```typescript
const OUTLINE_WIDTH_KEY = 'outline-panel-width';

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

export const saveOutlineWidth = (width: number): void => {
  try {
    localStorage.setItem(OUTLINE_WIDTH_KEY, String(width));
  } catch (e) {
    console.error('Failed to save outline width:', e);
  }
};

export const getValidatedOutlineWidth = (width: number): number => {
  const maxWidth = window.innerWidth * MAX_OUTLINE_WIDTH_RATIO;
  return Math.max(MIN_OUTLINE_WIDTH, Math.min(maxWidth, width));
};
```

### 5. Drag Logic

Extend `src/hooks/useLayout.ts`:

```typescript
const setupResizeHandlers = () => {
  const handleMouseMove = (e: MouseEvent) => {
    // Sidebar dragging (existing)
    if (appStore.isDragging()) {
      const newWidth = getValidatedSidebarWidth(e.clientX - 52);
      appStore.setSidebarWidth(newWidth);
      saveSidebarWidth(newWidth);
    }
    
    // Outline dragging (new)
    if (appStore.isOutlineDragging()) {
      const newWidth = getValidatedOutlineWidth(window.innerWidth - e.clientX);
      appStore.setOutlineWidth(newWidth);
      saveOutlineWidth(newWidth);
    }
  };

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

  // ... existing resize listeners unchanged
};

const startOutlineDragging = () => {
  appStore.setIsOutlineDragging(true);
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
};

const getOutlineTransitionStyle = () => {
  return appStore.isOutlineDragging() ? 'none' : 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
};

return {
  setupResizeHandlers,
  startDragging,
  startOutlineDragging,  // new
  handleMobileOutlineToggle,
  getSidebarTransitionStyle,
  getOutlineTransitionStyle,  // new
};
```

### 6. Initialization

In `src/App.tsx`, load saved width on mount:

```typescript
import { loadOutlineWidth } from './utils/settings';

onMount(() => {
  const savedWidth = loadOutlineWidth();
  appStore.initOutlineWidth(savedWidth);
});
```

### 7. Props Propagation

Update component chains to pass new props:

**DesktopLayout** (`src/layouts/DesktopLayout.tsx`):
- Receive `outlineWidth` and `outlineTransition` from App
- Pass to MainPane

**MainPane** (`src/components/MainPane.tsx`):
- Receive new props
- Pass to OutlinePanel

**OutlinePanel**: Use props for dynamic width and drag handling

## File Modifications

Files requiring changes:

1. `src/types/app.ts` - Add constants
2. `src/stores/appStore.ts` - Add state and methods
3. `src/utils/settings.ts` - Add persistence functions
4. `src/hooks/useLayout.ts` - Add drag logic
5. `src/components/OutlinePanel.tsx` - Add resize handle and dynamic width
6. `src/index.css` - Add resize handle styles, modify outline-panel
7. `src/layouts/DesktopLayout.tsx` - Pass new props
8. `src/components/MainPane.tsx` - Pass new props
9. `src/App.tsx` - Initialize width loading

## Edge Cases

### Window Resize
When window is resized, validate that current outline width doesn't exceed new max (40% of new window width):

```typescript
const handleResize = () => {
  appStore.checkMobile();
  
  const maxWidth = window.innerWidth * MAX_OUTLINE_WIDTH_RATIO;
  const currentOutlineWidth = appStore.outlineWidth();
  if (currentOutlineWidth > maxWidth) {
    appStore.setOutlineWidth(maxWidth);
    saveOutlineWidth(maxWidth);
  }
  
  // Sidebar resize validation (existing)
  // ...
};
```

### Mobile Layout
Outline resize functionality should be disabled on mobile (width < 768px). The existing `appStore.checkMobile()` already handles this scenario.

### Panel Hidden State
When outline panel is hidden (`isOpen: false`), the width should still be maintained so it's preserved when reopened.

## Testing Considerations

- Verify width persistence across page reloads
- Test width validation (min/max constraints)
- Test window resize behavior
- Test interaction with existing sidebar drag (no interference)
- Test on different screen sizes

## Success Criteria

- Users can drag the outline panel left border to resize
- Width is saved and restored on next session
- Width respects min/max constraints
- Smooth transition animations (except during drag)
- No interference with sidebar functionality
- Consistent behavior with sidebar implementation