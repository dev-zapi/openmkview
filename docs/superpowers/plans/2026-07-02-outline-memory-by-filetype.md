# Outline Memory by File Type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现大纲边栏按文件类型记忆打开状态，切换文件时自动调整大纲状态

**Architecture:** 使用 localStorage 存储文件类型状态映射，在 appStore 中管理状态，在 App.tsx 中实现自动切换逻辑，修改 useLayout.ts 的切换函数更新记忆

**Tech Stack:** SolidJS, TypeScript, localStorage

---

## File Structure

**Modified Files:**
- `frontend/src/utils/settings.ts` - 添加存储函数和类型定义
- `frontend/src/stores/appStore.ts` - 添加状态信号和方法
- `frontend/src/App.tsx` - 添加自动切换效果
- `frontend/src/hooks/useLayout.ts` - 修改用户切换逻辑
- `frontend/src/test/utils/settings.test.ts` - 添加新函数的单元测试
- `frontend/src/test/stores/appStore.test.ts` - 添加新方法的单元测试

---

### Task 1: Add Storage Functions to settings.ts

**Files:**
- Modify: `frontend/src/utils/settings.ts`
- Test: `frontend/src/test/utils/settings.test.ts`

- [ ] **Step 1: Write the failing tests for loadOutlineOpenByFileType**

Add to `frontend/src/test/utils/settings.test.ts`:

```typescript
import { loadOutlineOpenByFileType, saveOutlineOpenByFileType } from '../../utils/settings';

describe('loadOutlineOpenByFileType', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should return default state when localStorage is empty', () => {
    const result = loadOutlineOpenByFileType();
    expect(result).toEqual({
      markdown: false,
      html: false,
      other: false,
    });
  });

  it('should load state from localStorage', () => {
    const savedState = { markdown: true, html: false, other: false };
    localStorage.setItem('outline-open-by-filetype', JSON.stringify(savedState));
    const result = loadOutlineOpenByFileType();
    expect(result).toEqual(savedState);
  });

  it('should handle partial state with defaults', () => {
    const partialState = { markdown: true };
    localStorage.setItem('outline-open-by-filetype', JSON.stringify(partialState));
    const result = loadOutlineOpenByFileType();
    expect(result).toEqual({
      markdown: true,
      html: false,
      other: false,
    });
  });

  it('should handle JSON parse errors gracefully', () => {
    localStorage.setItem('outline-open-by-filetype', 'invalid-json');
    const result = loadOutlineOpenByFileType();
    expect(result).toEqual({
      markdown: false,
      html: false,
      other: false,
    });
  });
});

describe('saveOutlineOpenByFileType', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should save state to localStorage', () => {
    const state = { markdown: true, html: false, other: false };
    saveOutlineOpenByFileType(state);
    const saved = localStorage.getItem('outline-open-by-filetype');
    expect(saved).toBe(JSON.stringify(state));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- settings.test.ts`
Expected: Tests fail with "loadOutlineOpenByFileType is not defined"

- [ ] **Step 3: Add constants and type definition to settings.ts**

Add to `frontend/src/utils/settings.ts` after line 6:

```typescript
const OUTLINE_OPEN_BY_FILETYPE_KEY = 'outline-open-by-filetype';

export interface OutlineOpenByFileType {
  markdown: boolean;
  html: boolean;
  other: boolean;
}

const DEFAULT_OUTLINE_OPEN_STATE: OutlineOpenByFileType = {
  markdown: false,
  html: false,
  other: false,
};
```

- [ ] **Step 4: Add loadOutlineOpenByFileType function**

Add to `frontend/src/utils/settings.ts` after the existing functions (around line 182):

```typescript
export const loadOutlineOpenByFileType = (): OutlineOpenByFileType => {
  try {
    const saved = localStorage.getItem(OUTLINE_OPEN_BY_FILETYPE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        markdown: parsed.markdown ?? false,
        html: parsed.html ?? false,
        other: parsed.other ?? false,
      };
    }
  } catch (e) {
    console.error('Failed to load outline open state by filetype:', e);
  }
  return DEFAULT_OUTLINE_OPEN_STATE;
};
```

- [ ] **Step 5: Add saveOutlineOpenByFileType function**

Add to `frontend/src/utils/settings.ts` immediately after loadOutlineOpenByFileType:

```typescript
export const saveOutlineOpenByFileType = (state: OutlineOpenByFileType): void => {
  try {
    localStorage.setItem(OUTLINE_OPEN_BY_FILETYPE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save outline open state by filetype:', e);
  }
};
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd frontend && npm test -- settings.test.ts`
Expected: All tests pass

- [ ] **Step 7: Commit changes**

```bash
git add frontend/src/utils/settings.ts frontend/src/test/utils/settings.test.ts
git commit -m "feat: add outline open state storage functions by filetype"
```

---

### Task 2: Add State Management to appStore.ts

**Files:**
- Modify: `frontend/src/stores/appStore.ts`
- Test: `frontend/src/test/stores/appStore.test.ts`

- [ ] **Step 1: Write the failing tests for new methods**

Add to `frontend/src/test/stores/appStore.test.ts`:

```typescript
import { loadOutlineOpenByFileType, saveOutlineOpenByFileType } from '../../utils/settings';

describe('appStore outline by filetype', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getOutlineOpenForFileType', () => {
    it('should return false for markdown by default', () => {
      expect(appStore.getOutlineOpenForFileType('markdown')).toBe(false);
    });

    it('should return false for html by default', () => {
      expect(appStore.getOutlineOpenForFileType('html')).toBe(false);
    });

    it('should return false for other by default', () => {
      expect(appStore.getOutlineOpenForFileType('other')).toBe(false);
    });

    it('should return true after setting markdown to true', () => {
      appStore.setOutlineOpenForFileType('markdown', true);
      expect(appStore.getOutlineOpenForFileType('markdown')).toBe(true);
    });
  });

  describe('setOutlineOpenForFileType', () => {
    it('should update state and save to localStorage', () => {
      appStore.setOutlineOpenForFileType('html', true);
      expect(appStore.getOutlineOpenForFileType('html')).toBe(true);
      
      const saved = localStorage.getItem('outline-open-by-filetype');
      expect(saved).toBe(JSON.stringify({ markdown: false, html: true, other: false }));
    });

    it('should not affect other file types', () => {
      appStore.setOutlineOpenForFileType('markdown', true);
      appStore.setOutlineOpenForFileType('html', true);
      
      expect(appStore.getOutlineOpenForFileType('markdown')).toBe(true);
      expect(appStore.getOutlineOpenForFileType('html')).toBe(true);
      expect(appStore.getOutlineOpenForFileType('other')).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- appStore.test.ts`
Expected: Tests fail with "getOutlineOpenForFileType is not defined"

- [ ] **Step 3: Add import to appStore.ts**

Modify `frontend/src/stores/appStore.ts` line 3:

```typescript
import { createSignal } from 'solid-js';
import type { TabType } from '../components/markdown-header/ViewTabs';
import { DEFAULT_OUTLINE_WIDTH } from '../types/app';
import { loadOutlineOpenByFileType, saveOutlineOpenByFileType } from '../utils/settings';
import type { OutlineOpenByFileType } from '../utils/settings';
```

- [ ] **Step 4: Add signal for outline open by filetype**

Add to `frontend/src/stores/appStore.ts` after line 19 (after `trashDialogOpen` signal):

```typescript
const [outlineOpenByFileType, setOutlineOpenByFileTypeState] = createSignal<OutlineOpenByFileType>(loadOutlineOpenByFileType());
```

- [ ] **Step 5: Add methods to appStore object**

Add to `frontend/src/stores/appStore.ts` in the exported object (around line 107, after `checkMobile` method):

```typescript
  getOutlineOpenForFileType(fileType: 'markdown' | 'html' | 'other'): boolean {
    return outlineOpenByFileType()[fileType];
  },

  setOutlineOpenForFileType(fileType: 'markdown' | 'html' | 'other', open: boolean): void {
    setOutlineOpenByFileTypeState(prev => {
      const updated = { ...prev, [fileType]: open };
      saveOutlineOpenByFileType(updated);
      return updated;
    });
  },
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd frontend && npm test -- appStore.test.ts`
Expected: All tests pass

- [ ] **Step 7: Commit changes**

```bash
git add frontend/src/stores/appStore.ts frontend/src/test/stores/appStore.test.ts
git commit -m "feat: add outline state management by filetype to appStore"
```

---

### Task 3: Add File Type Detection Helper

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add file type detection function**

Add to `frontend/src/App.tsx` after the imports (around line 16, before `const App: Component`):

```typescript
function getFileTypeCategory(fileName: string): 'markdown' | 'html' | 'other' {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith('.md') || lowerName.endsWith('.markdown')) {
    return 'markdown';
  }
  if (lowerName.endsWith('.html') || lowerName.endsWith('.htm')) {
    return 'html';
  }
  return 'other';
}
```

- [ ] **Step 2: Commit changes**

```bash
git add frontend/src/App.tsx
git commit -m "feat: add file type detection helper function"
```

---

### Task 4: Add Auto-switch Effect to App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add effect for automatic outline switching**

Add to `frontend/src/App.tsx` after line 37 (after the first `createEffect` block):

```typescript
  createEffect(() => {
    const currentFile = fileStore.currentFile();
    const outlineOpen = appStore.outlineOpen();
    
    if (!currentFile) {
      if (outlineOpen) {
        appStore.setOutlineOpen(false);
      }
      return;
    }
    
    const fileTypeCategory = getFileTypeCategory(currentFile.fileName);
    const shouldBeOpen = appStore.getOutlineOpenForFileType(fileTypeCategory);
    
    if (shouldBeOpen !== outlineOpen) {
      appStore.setOutlineOpen(shouldBeOpen);
    }
  });
```

- [ ] **Step 2: Commit changes**

```bash
git add frontend/src/App.tsx
git commit -m "feat: add automatic outline switching effect"
```

---

### Task 5: Update User Toggle Handler in useLayout.ts

**Files:**
- Modify: `frontend/src/hooks/useLayout.ts`

- [ ] **Step 1: Import file type detection function**

Modify `frontend/src/hooks/useLayout.ts` imports at line 1:

```typescript
import { onMount, onCleanup } from 'solid-js';
import { appStore } from '../stores/appStore';
import { settingsStore } from '../stores/settingsStore';
import { fileStore } from '../stores/fileStore';
import { 
  saveSidebarWidth, 
  getValidatedSidebarWidth,
  saveOutlineWidth,
  getValidatedOutlineWidth 
} from '../utils/settings';
import { mobileLayoutStore } from '../stores/mobileLayoutStore';

function getFileTypeCategory(fileName: string): 'markdown' | 'html' | 'other' {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith('.md') || lowerName.endsWith('.markdown')) {
    return 'markdown';
  }
  if (lowerName.endsWith('.html') || lowerName.endsWith('.htm')) {
    return 'html';
  }
  return 'other';
}
```

- [ ] **Step 2: Update handleMobileOutlineToggle function**

Modify `frontend/src/hooks/useLayout.ts` lines 82-88 (the `handleMobileOutlineToggle` function):

```typescript
  const handleMobileOutlineToggle = () => {
    if (appStore.isMobile()) {
      mobileLayoutStore.toggleRightDrawer();
    } else {
      const currentFile = fileStore.currentFile();
      if (!currentFile) return;
      
      const fileTypeCategory = getFileTypeCategory(currentFile.fileName);
      const newState = !appStore.outlineOpen();
      
      appStore.setOutlineOpen(newState);
      appStore.setOutlineOpenForFileType(fileTypeCategory, newState);
    }
  };
```

- [ ] **Step 3: Commit changes**

```bash
git add frontend/src/hooks/useLayout.ts
git commit -m "feat: update outline toggle to save state by filetype"
```

---

### Task 6: Manual Testing and Verification

**Files:**
- None (manual testing)

- [ ] **Step 1: Run all existing tests**

Run: `cd frontend && npm test`
Expected: All existing tests pass (no regression)

- [ ] **Step 2: Start development server**

Run: `cd frontend && npm run dev`
Expected: Server starts successfully

- [ ] **Step 3: Test markdown file outline memory**

Manual steps:
1. Open a `.md` file → Outline should be closed (default)
2. Click outline toggle button → Outline opens
3. Switch to another `.md` file → Outline should automatically open
4. Close outline → Switch to another `.md` file → Outline should stay closed

- [ ] **Step 4: Test html file outline memory**

Manual steps:
1. Open an `.html` file → Outline should be closed
2. Click outline toggle → Outline opens
3. Switch to another `.html` file → Outline should automatically open
4. Switch to `.md` file → Outline should use markdown's saved state

- [ ] **Step 5: Test other file types**

Manual steps:
1. Open a `.md` file with outline open
2. Switch to an image file → Outline should automatically close
3. Switch back to `.md` file → Outline should automatically open (memory preserved)

- [ ] **Step 6: Test persistence across reload**

Manual steps:
1. Open `.md` file, toggle outline to open
2. Refresh page
3. Open same `.md` file → Outline should automatically open (localStorage persisted)

- [ ] **Step 7: Verify localStorage content**

Manual steps:
1. Open browser DevTools → Application → Local Storage
2. Check `outline-open-by-filetype` key
3. Verify value is `{markdown: true, html: false, other: false}` after testing

---

### Task 7: Run Build and Final Checks

**Files:**
- None (build verification)

- [ ] **Step 1: Run TypeScript type check**

Run: `cd frontend && npm run type-check`
Expected: No type errors

- [ ] **Step 2: Run production build**

Run: `cd frontend && npm run build`
Expected: Build succeeds without errors

- [ ] **Step 3: Run all tests one final time**

Run: `cd frontend && npm test`
Expected: All tests pass including new tests

- [ ] **Step 4: Final commit (if any fixes needed)**

If any fixes were needed during manual testing:

```bash
git add .
git commit -m "fix: resolve outline memory implementation issues"
```

---

## Summary

This implementation plan follows TDD principles where applicable (Task 1 & 2 have unit tests), and includes comprehensive manual testing for the reactive behavior. Each task produces self-contained changes that can be independently verified.

**Total estimated time:** 2-3 hours including manual testing

**Dependencies:** None - all tasks can be executed sequentially

**Risks:** 
- SolidJS reactive effects can be tricky - manual testing is critical
- localStorage behavior varies by browser - test in multiple browsers if needed