# Code Block Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add language tag and copy button to code blocks in Markdown preview

**Architecture:** CSS + DOM post-processing approach - after Markdown rendering, traverse all `<pre>` elements and insert header container with language tag and copy button

**Tech Stack:** SolidJS, TypeScript, CSS

---

## Task 1: Add CSS styles for code block header

**Files:**
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Add light theme styles**

Add the following CSS to `frontend/src/styles/global.css` after the existing `.shiki` styles (around line 543):

```css
/* Code block header - light theme */
.code-block-header {
  position: absolute;
  top: 8px;
  right: 12px;
  display: flex;
  gap: 8px;
  align-items: center;
  z-index: 10;
}

.code-lang-tag {
  font-size: 12px;
  color: #24292f;
  background: rgba(255, 255, 255, 0.8);
  padding: 2px 6px;
  border-radius: 3px;
}

.copy-button {
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid #d0d7de;
  color: #24292f;
  padding: 4px 8px;
  border-radius: 3px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.copy-button:hover {
  background: rgba(255, 255, 255, 1);
}

.copy-button.copied {
  color: #1a7f37;
}

.copy-button.failed {
  color: #cf222e;
}
```

- [ ] **Step 2: Add dark theme styles**

Add the following CSS after the light theme styles:

```css
/* Code block header - dark theme */
.markdown-view.dark .code-block-header,
.markdown-view[data-theme="dark"] .code-block-header {
  top: 8px;
  right: 12px;
}

.markdown-view.dark .code-lang-tag,
.markdown-view[data-theme="dark"] .code-lang-tag {
  color: #c9d1d9;
  background: rgba(110, 118, 129, 0.4);
}

.markdown-view.dark .copy-button,
.markdown-view[data-theme="dark"] .copy-button {
  background: rgba(110, 118, 129, 0.4);
  border: 1px solid #30363d;
  color: #c9d1d9;
}

.markdown-view.dark .copy-button:hover,
.markdown-view[data-theme="dark"] .copy-button:hover {
  background: rgba(110, 118, 129, 0.6);
}

.markdown-view.dark .copy-button.copied,
.markdown-view[data-theme="dark"] .copy-button.copied {
  color: #3fb950;
}

.markdown-view.dark .copy-button.failed,
.markdown-view[data-theme="dark"] .copy-button.failed {
  color: #f85149;
}
```

- [ ] **Step 3: Add positioning styles for pre elements**

Add the following CSS to ensure `<pre>` elements can contain positioned headers:

```css
/* Ensure pre elements can contain positioned headers */
.markdown-view pre {
  position: relative;
}
```

This should be added to the existing `.markdown-view pre` rule around line 44.

- [ ] **Step 4: Commit CSS changes**

Run:
```bash
git add frontend/src/styles/global.css
git commit -m "style: add code block header CSS styles"
```

---

## Task 2: Add code block header processing logic

**Files:**
- Modify: `frontend/src/components/MarkdownView.tsx:149-161`

- [ ] **Step 1: Add helper function to create code block header**

Add the following function before the `renderMarkdown` function in `frontend/src/components/MarkdownView.tsx` (around line 35):

```typescript
const addCodeBlockHeaders = (container: HTMLElement, theme: 'light' | 'dark') => {
  const preElements = container.querySelectorAll('pre');
  
  preElements.forEach((pre) => {
    // Prevent duplicate headers
    if (pre.querySelector('.code-block-header')) return;
    
    // Get language from data-lang attribute
    const lang = pre.getAttribute('data-lang') || 'text';
    
    // Create header container
    const header = document.createElement('div');
    header.className = `code-block-header`;
    if (theme === 'dark') {
      header.setAttribute('data-theme', 'dark');
    }
    
    // Create language tag
    const langTag = document.createElement('span');
    langTag.className = 'code-lang-tag';
    langTag.textContent = lang;
    
    // Create copy button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-button';
    copyBtn.textContent = '📋 复制';
    
    copyBtn.onclick = async () => {
      const code = pre.querySelector('code')?.textContent || '';
      try {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(code);
        } else {
          // Fallback for older browsers
          const textarea = document.createElement('textarea');
          textarea.value = code;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
        }
        copyBtn.textContent = '已复制';
        copyBtn.classList.add('copied');
        setTimeout(() => {
          copyBtn.textContent = '📋 复制';
          copyBtn.classList.remove('copied');
        }, 2000);
      } catch {
        copyBtn.textContent = '复制失败';
        copyBtn.classList.add('failed');
        setTimeout(() => {
          copyBtn.textContent = '📋 复制';
          copyBtn.classList.remove('failed');
        }, 2000);
      }
    };
    
    header.appendChild(langTag);
    header.appendChild(copyBtn);
    pre.appendChild(header);
  });
};
```

- [ ] **Step 2: Call header processing in renderMarkdown**

Modify the `setTimeout` block in `renderMarkdown` function (around line 149-154) to call the header processing:

```typescript
setTimeout(() => {
  if (containerRef) {
    // Add code block headers
    addCodeBlockHeaders(containerRef, props.theme || 'light');
    
    // Extract headings (existing logic)
    if (props.onHeadingsExtracted) {
      const headings = extractHeadingsFromHtml();
      props.onHeadingsExtracted?.(headings);
    }
  }
}, 0);
```

- [ ] **Step 3: Import theme prop type (if needed)**

Verify `props.theme` is defined in `MarkdownViewProps` interface. If not, add:

```typescript
interface MarkdownViewProps {
  content: string;
  class?: string;
  theme?: 'light' | 'dark';  // Ensure this line exists
  onHeadingsExtracted?: (headings: Heading[]) => void;
  currentFilePath?: string;
  projectId?: number;
  searchQuery?: string;
  currentSearchResult?: number;
  onSearchResultsChange?: (count: number) => void;
}
```

- [ ] **Step 4: Test in browser**

Run the dev server and verify:
1. Code blocks show language tags
2. Copy button appears
3. Copy functionality works
4. Light/dark theme styles correct

Run:
```bash
cd frontend && npm run dev
```

Open browser to a Markdown file with code blocks and verify the header appears.

- [ ] **Step 5: Commit implementation**

Run:
```bash
git add frontend/src/components/MarkdownView.tsx
git commit -m "feat: add code block header with language tag and copy button"
```

---

## Task 3: Update theme handling for dark mode

**Files:**
- Modify: `frontend/src/components/MarkdownView.tsx`

- [ ] **Step 1: Add theme-aware rendering**

The existing code already uses `props.theme`. Verify that the theme is passed from parent components. Check `FileContentView.tsx` and `App.tsx` to ensure theme prop is propagated.

If the markdown view already has theme handling, no changes needed. The `addCodeBlockHeaders` function already uses `props.theme`.

- [ ] **Step 2: Test dark mode**

Open settings and switch to dark theme. Verify:
1. Language tag has dark background
2. Copy button has dark styling
3. Colors are correct (text: #c9d1d9, background: rgba(110,118,129,0.4))

- [ ] **Step 3: Commit (if changes made)**

If any changes were needed:
```bash
git add frontend/src/components/MarkdownView.tsx
git commit -m "fix: ensure theme prop propagates to MarkdownView"
```

If no changes needed, skip this step.

---

## Task 4: Final testing and verification

**Files:**
- Test: All modified files

- [ ] **Step 1: Run lint and typecheck**

Run:
```bash
cd frontend && npm run lint && npm run typecheck
```

Expected: No errors

- [ ] **Step 2: Manual testing checklist**

Verify:
- [ ] Code blocks with explicit language (rust, js, python) show correct tag
- [ ] Code blocks without language show "text"
- [ ] Copy button copies code to clipboard
- [ ] "已复制" feedback appears after copy
- [ ] "复制失败" appears if copy fails
- [ ] Light theme styling correct
- [ ] Dark theme styling correct
- [ ] Multiple code blocks on same page all have headers
- [ ] No duplicate headers on re-render

- [ ] **Step 3: Final commit**

Run:
```bash
git add -A
git commit -m "feat: complete code block header implementation"
```

---

## Notes

- Language tag displays in lowercase (e.g., "rust", "javascript")
- Copy button uses emoji icon "📋" for simplicity
- Header positioned at `top: 8px`, `right: 12px`
- Copy feedback duration: 2 seconds
- Fallback to `execCommand('copy')` for older browsers