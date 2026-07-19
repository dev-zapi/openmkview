import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, fireEvent } from '@solidjs/testing-library';
import MarkdownView from '../../components/MarkdownView';

// Mock fetch for PlantUML
global.fetch = vi.fn();

// Mock mermaid
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockImplementation(async (id: string, code: string) => {
      if (code.includes('graph TD') || code.includes('graph LR')) {
        return { svg: `<svg id="${id}">mocked mermaid diagram</svg>` };
      }
      throw new Error('Parse error on line 1');
    }),
  },
}));

// Mock IntersectionObserver
class MockIntersectionObserver {
  private callback: IntersectionObserverCallback;
  
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }
  
  observe = vi.fn((element: Element) => {
    // Immediately trigger intersection for testing
    this.callback([
      {
        target: element,
        isIntersecting: true,
        boundingClientRect: {} as DOMRectReadOnly,
        intersectionRatio: 1,
        intersectionRect: {} as DOMRectReadOnly,
        rootBounds: null,
        time: Date.now(),
      } as IntersectionObserverEntry,
    ], this as any);
  });
  
  unobserve = vi.fn();
  disconnect = vi.fn();
}

global.IntersectionObserver = MockIntersectionObserver as any;

describe('Diagram Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render mermaid diagram in markdown', async () => {
      const markdown = `
# Test

\`\`\`mermaid
graph TD
A-->B
\`\`\`
`;

      const { container } = render(() => (
        <MarkdownView content={markdown} theme="light" />
      ));

      await waitFor(() => {
        expect(container.querySelector('.code-block-wrapper')).toBeTruthy();
      });
    });

    it('should render plantuml diagram in markdown', async () => {
      const mockSvg = '<svg>plantuml test</svg>';
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockSvg),
      });

      const markdown = `
# Test

\`\`\`plantuml
@startuml
A -> B
@enduml
\`\`\`
`;

      const { container } = render(() => (
        <MarkdownView content={markdown} theme="light" />
      ));

      await waitFor(() => {
        expect(container.querySelector('.code-block-wrapper')).toBeTruthy();
      });
    });

    it('should render multiple diagrams', async () => {
      const mockSvg = '<svg>test</svg>';
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockSvg),
      });

      const markdown = `
# Multiple Diagrams

\`\`\`mermaid
graph TD
A-->B
\`\`\`

\`\`\`plantuml
@startuml
A -> B
@enduml
\`\`\`
`;

      const { container } = render(() => (
        <MarkdownView content={markdown} theme="light" />
      ));

      await waitFor(() => {
        const wrappers = container.querySelectorAll('.code-block-wrapper');
        expect(wrappers.length).toBe(2);
      });
    });

    it('should handle diagram errors gracefully', async () => {
      const markdown = `
# Error Test

\`\`\`mermaid
invalid code
\`\`\`
`;

      const { container } = render(() => (
        <MarkdownView content={markdown} theme="light" />
      ));

      await waitFor(() => {
        expect(container.querySelector('.code-block-wrapper')).toBeTruthy();
      });
    });
  });

  describe('UI Elements', () => {
    it('should have toggle and zoom buttons for diagram code blocks', async () => {
      const markdown = `
# Test

\`\`\`mermaid
graph TD
A-->B
\`\`\`
`;

      const { container } = render(() => (
        <MarkdownView content={markdown} theme="light" />
      ));

      await waitFor(() => {
        const toggleBtn = container.querySelector('.diagram-toggle-btn');
        const zoomBtn = container.querySelector('.diagram-zoom-btn');
        expect(toggleBtn).toBeTruthy();
        expect(zoomBtn).toBeTruthy();
      });
    });

    it('should not have toggle/zoom buttons for regular code blocks', async () => {
      const markdown = `
# Test

\`\`\`javascript
const x = 1;
\`\`\`
`;

      const { container } = render(() => (
        <MarkdownView content={markdown} theme="light" />
      ));

      await waitFor(() => {
        const toggleBtn = container.querySelector('.diagram-toggle-btn');
        const zoomBtn = container.querySelector('.diagram-zoom-btn');
        expect(toggleBtn).toBeFalsy();
        expect(zoomBtn).toBeFalsy();
      });
    });

    it('should have language tag in header', async () => {
      const markdown = `
# Test

\`\`\`mermaid
graph TD
A-->B
\`\`\`
`;

      const { container } = render(() => (
        <MarkdownView content={markdown} theme="light" />
      ));

      await waitFor(() => {
        const langTag = container.querySelector('.code-lang-tag');
        expect(langTag).toBeTruthy();
        expect(langTag?.textContent).toBe('mermaid');
      });
    });

    it('should have copy button in header', async () => {
      const markdown = `
# Test

\`\`\`mermaid
graph TD
A-->B
\`\`\`
`;

      const { container } = render(() => (
        <MarkdownView content={markdown} theme="light" />
      ));

      await waitFor(() => {
        const copyBtn = container.querySelector('.copy-button');
        expect(copyBtn).toBeTruthy();
        // Header should be visible (copy button is inside it)
        const header = container.querySelector('.code-block-header') as HTMLElement;
        expect(header).toBeTruthy();
        expect(getComputedStyle(header).display).not.toBe('none');
      });
    });
  });

  describe('Mode Switching', () => {
    it('should toggle between source and rendered diagram', async () => {
      const markdown = `
# Test

\`\`\`mermaid
graph TD
A-->B
\`\`\`
`;

      const { container } = render(() => (
        <MarkdownView content={markdown} theme="light" />
      ));

      await waitFor(() => {
        expect(container.querySelector('.diagram-toggle-btn')).toBeTruthy();
      });

      const toggleBtn = container.querySelector('.diagram-toggle-btn') as HTMLButtonElement;
      const wrapper = container.querySelector('.code-block-wrapper') as HTMLDivElement;

      // Initially should be in render mode (diagram rendered)
      await waitFor(() => {
        expect(wrapper.querySelector('.diagram-rendered')).toBeTruthy();
      }, { timeout: 5000 });

      // Click to switch to source mode
      toggleBtn.click();

      await waitFor(() => {
        expect(wrapper.querySelector('pre[data-lang="mermaid"]')).toBeTruthy();
      });

      // Click again to go back to render mode
      toggleBtn.click();

      await waitFor(() => {
        expect(wrapper.querySelector('.diagram-rendered')).toBeTruthy();
      }, { timeout: 5000 });
    });

    it('should show zoom button in rendered mode', async () => {
      const markdown = `
# Test

\`\`\`mermaid
graph TD
A-->B
\`\`\`
`;

      const { container } = render(() => (
        <MarkdownView content={markdown} theme="light" />
      ));

      await waitFor(() => {
        expect(container.querySelector('.diagram-toggle-btn')).toBeTruthy();
      });

      const zoomBtn = container.querySelector('.diagram-zoom-btn') as HTMLButtonElement;

      // In render mode, zoom button should be visible
      await waitFor(() => {
        expect(zoomBtn.style.display).toBe('');
        const header = container.querySelector('.code-block-header') as HTMLElement;
        expect(header).toBeTruthy();
        // Verify header is actually visible (not hidden by CSS display: none)
        expect(getComputedStyle(header).display).not.toBe('none');
      });
    });

    it('should hide zoom button in source mode', async () => {
      const markdown = `
# Test

\`\`\`mermaid
graph TD
A-->B
\`\`\`
`;

      const { container } = render(() => (
        <MarkdownView content={markdown} theme="light" />
      ));

      await waitFor(() => {
        expect(container.querySelector('.diagram-toggle-btn')).toBeTruthy();
      });

      const toggleBtn = container.querySelector('.diagram-toggle-btn') as HTMLButtonElement;
      const zoomBtn = container.querySelector('.diagram-zoom-btn') as HTMLButtonElement;

      // Initially in render mode, zoom should be visible
      await waitFor(() => {
        expect(zoomBtn.style.display).toBe('');
      });

      // Switch to source mode
      toggleBtn.click();

      await waitFor(() => {
        expect(zoomBtn.style.display).toBe('none');
        // Header should still be visible in source mode (not hidden by CSS)
        const header = container.querySelector('.code-block-header') as HTMLElement;
        expect(header).toBeTruthy();
        expect(getComputedStyle(header).display).not.toBe('none');
      });

      // Switch back to render mode
      toggleBtn.click();

      await waitFor(() => {
        expect(zoomBtn.style.display).toBe('');
        // Header should be visible in render mode too
        const header = container.querySelector('.code-block-header') as HTMLElement;
        expect(header).toBeTruthy();
        expect(getComputedStyle(header).display).not.toBe('none');
      });
    });

    it('should toggle multiple times without errors', async () => {
      const markdown = `
# Test

\`\`\`mermaid
graph TD
A-->B
\`\`\`
`;

      const { container } = render(() => (
        <MarkdownView content={markdown} theme="light" />
      ));

      await waitFor(() => {
        expect(container.querySelector('.diagram-toggle-btn')).toBeTruthy();
      });

      const toggleBtn = container.querySelector('.diagram-toggle-btn') as HTMLButtonElement;

      // Toggle multiple times - just verify no errors are thrown
      for (let i = 0; i < 3; i++) {
        toggleBtn.click();
        await new Promise((resolve) => setTimeout(resolve, 100));
        toggleBtn.click();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Should still have the toggle button
      expect(container.querySelector('.diagram-toggle-btn')).toBeTruthy();
    });
  });

  describe('Mixed Content', () => {
    it('should handle mixed code blocks and diagrams', async () => {
      const markdown = `
# Mixed Content

\`\`\`javascript
const x = 1;
\`\`\`

\`\`\`mermaid
graph TD
A-->B
\`\`\`

\`\`\`python
print("hello")
\`\`\`

\`\`\`plantuml
@startuml
A -> B
@enduml
\`\`\`
`;

      const { container } = render(() => (
        <MarkdownView content={markdown} theme="light" />
      ));

      await waitFor(() => {
        // Only diagram languages get wrapped in .code-block-wrapper
        const wrappers = container.querySelectorAll('.code-block-wrapper');
        expect(wrappers.length).toBe(2);

        // Both wrappers should have diagram buttons
        wrappers.forEach((wrapper) => {
          expect(wrapper.querySelector('.diagram-toggle-btn')).toBeTruthy();
          expect(wrapper.querySelector('.diagram-zoom-btn')).toBeTruthy();
        });

        // All code blocks should have headers with language tags
        const langTags = container.querySelectorAll('.code-lang-tag');
        expect(langTags.length).toBe(4);
      });
    });
  });

  describe('Theme Support', () => {
    it('should render with dark theme', async () => {
      const markdown = `
# Test

\`\`\`mermaid
graph TD
A-->B
\`\`\`
`;

      const { container } = render(() => (
        <MarkdownView content={markdown} theme="dark" />
      ));

      await waitFor(() => {
        expect(container.querySelector('.code-block-wrapper')).toBeTruthy();
      });
    });
  });

  describe('Default Display Mode', () => {
    it('should default diagram code blocks to rendered mode', async () => {
      const markdown = `
# Test

\`\`\`mermaid
graph TD
A-->B
\`\`\`
`;

      const { container } = render(() => (
        <MarkdownView content={markdown} theme="light" />
      ));

      await waitFor(() => {
        const wrapper = container.querySelector('.code-block-wrapper') as HTMLDivElement;
        expect(wrapper).toBeTruthy();
        expect(wrapper.querySelector('.diagram-rendered')).toBeTruthy();
      }, { timeout: 10000 });

      // Source code should NOT be visible in default rendered mode
      const wrapper = container.querySelector('.code-block-wrapper') as HTMLDivElement;
      expect(wrapper.querySelector('pre[data-lang="mermaid"]')).toBeFalsy();

      // Header should be visible in rendered mode (not hidden by CSS display: none)
      const header = container.querySelector('.code-block-header') as HTMLElement;
      expect(header).toBeTruthy();
      expect(getComputedStyle(header).display).not.toBe('none');
    });

    it('should have all header buttons visible in rendered diagram mode', async () => {
      const markdown = `
# Test

\`\`\`mermaid
graph TD
A-->B
\`\`\`
`;

      const { container } = render(() => (
        <MarkdownView content={markdown} theme="light" />
      ));

      await waitFor(() => {
        const wrapper = container.querySelector('.code-block-wrapper') as HTMLDivElement;
        expect(wrapper).toBeTruthy();
        expect(wrapper.querySelector('.diagram-rendered')).toBeTruthy();
      }, { timeout: 10000 });

      // All header buttons should be visible (not hidden by CSS)
      const header = container.querySelector('.code-block-header') as HTMLElement;
      expect(getComputedStyle(header).display).not.toBe('none');

      const langTag = header.querySelector('.code-lang-tag') as HTMLElement;
      expect(langTag).toBeTruthy();

      const copyBtn = header.querySelector('.copy-button') as HTMLElement;
      expect(copyBtn).toBeTruthy();

      const toggleBtn = header.querySelector('.diagram-toggle-btn') as HTMLElement;
      expect(toggleBtn).toBeTruthy();

      const zoomBtn = header.querySelector('.diagram-zoom-btn') as HTMLElement;
      expect(zoomBtn).toBeTruthy();
      // zoom button should be visible in render mode (no inline display:none)
      expect(zoomBtn.style.display).toBe('');
    });

    it('should default regular code blocks to source display', async () => {
      const markdown = `
# Test

\`\`\`javascript
const x = 1;
\`\`\`
`;

      const { container } = render(() => (
        <MarkdownView content={markdown} theme="light" />
      ));

      await waitFor(() => {
        const pre = container.querySelector('pre[data-lang="javascript"]');
        expect(pre).toBeTruthy();
      });

      // Regular code blocks should NOT have diagram-rendered element
      expect(container.querySelector('.diagram-rendered')).toBeFalsy();
      expect(container.querySelector('.code-block-wrapper')).toBeFalsy();
    });

    it('should not have toggle button for regular code blocks', async () => {
      const markdown = `
# Test

\`\`\`python
print("hello")
\`\`\`
`;

      const { container } = render(() => (
        <MarkdownView content={markdown} theme="light" />
      ));

      await waitFor(() => {
        expect(container.querySelector('pre[data-lang="python"]')).toBeTruthy();
      });

      expect(container.querySelector('.diagram-toggle-btn')).toBeFalsy();
      expect(container.querySelector('.diagram-zoom-btn')).toBeFalsy();
    });

    it('should not render zoom or toggle buttons for any non-diagram language', async () => {
      const markdown = `
# Test

\`\`\`javascript
const x = 1;
\`\`\`

\`\`\`typescript
const y: number = 2;
\`\`\`

\`\`\`python
print("hello")
\`\`\`

\`\`\`bash
echo "world"
\`\`\`

\`\`\`json
{"key": "value"}
\`\`\`

\`\`\`css
body { color: red; }
\`\`\`
`;

      const { container } = render(() => (
        <MarkdownView content={markdown} theme="light" />
      ));

      await waitFor(() => {
        expect(container.querySelector('pre[data-lang="javascript"]')).toBeTruthy();
        expect(container.querySelector('pre[data-lang="typescript"]')).toBeTruthy();
        expect(container.querySelector('pre[data-lang="python"]')).toBeTruthy();
        expect(container.querySelector('pre[data-lang="bash"]')).toBeTruthy();
        expect(container.querySelector('pre[data-lang="json"]')).toBeTruthy();
        expect(container.querySelector('pre[data-lang="css"]')).toBeTruthy();
      });

      // None of these should have diagram buttons
      expect(container.querySelectorAll('.diagram-toggle-btn').length).toBe(0);
      expect(container.querySelectorAll('.diagram-zoom-btn').length).toBe(0);
      expect(container.querySelectorAll('.code-block-wrapper').length).toBe(0);
    });

    it('should have copy button for both regular and diagram code blocks', async () => {
      const markdown = `
# Test

\`\`\`javascript
const x = 1;
\`\`\`

\`\`\`mermaid
graph TD
A-->B
\`\`\`
`;

      const { container } = render(() => (
        <MarkdownView content={markdown} theme="light" />
      ));

      await waitFor(() => {
        const copyBtns = container.querySelectorAll('.copy-button');
        expect(copyBtns.length).toBe(2);
      });
    });
  });

  describe('Toggle Button Icons', () => {
    it('should show source icon and hide render icon in default diagram render mode', async () => {
      const markdown = `
# Test

\`\`\`mermaid
graph TD
A-->B
\`\`\`
`;

      const { container } = render(() => (
        <MarkdownView content={markdown} theme="light" />
      ));

      await waitFor(() => {
        const toggleBtn = container.querySelector('.diagram-toggle-btn');
        expect(toggleBtn).toBeTruthy();
      });

      const toggleBtn = container.querySelector('.diagram-toggle-btn') as HTMLButtonElement;

      // In render mode: source icon visible, render icon hidden
      const iconSource = toggleBtn.querySelector('.icon-source') as SVGElement;
      const iconRender = toggleBtn.querySelector('.icon-render') as SVGElement;
      expect(iconSource.style.display).not.toBe('none');
      expect(iconRender.style.display).toBe('none');
      expect(toggleBtn.title).toBe('查看源码');
    });

    it('should show render icon and hide source icon after toggling to source mode', async () => {
      const markdown = `
# Test

\`\`\`mermaid
graph TD
A-->B
\`\`\`
`;

      const { container } = render(() => (
        <MarkdownView content={markdown} theme="light" />
      ));

      await waitFor(() => {
        expect(container.querySelector('.diagram-toggle-btn')).toBeTruthy();
      });

      const toggleBtn = container.querySelector('.diagram-toggle-btn') as HTMLButtonElement;

      // Initially in render mode
      let iconSource = toggleBtn.querySelector('.icon-source') as SVGElement;
      let iconRender = toggleBtn.querySelector('.icon-render') as SVGElement;
      expect(iconSource.style.display).not.toBe('none');
      expect(iconRender.style.display).toBe('none');

      // Toggle to source mode
      toggleBtn.click();

      await waitFor(() => {
        const wrapper = container.querySelector('.code-block-wrapper') as HTMLDivElement;
        expect(wrapper.querySelector('pre[data-lang="mermaid"]')).toBeTruthy();
      });

      // Re-query icons (DOM may have been recreated)
      iconSource = toggleBtn.querySelector('.icon-source') as SVGElement;
      iconRender = toggleBtn.querySelector('.icon-render') as SVGElement;

      // In source mode: render icon visible, source icon hidden
      expect(iconSource.style.display).toBe('none');
      expect(iconRender.style.display).not.toBe('none');
      expect(toggleBtn.title).toBe('查看渲染图');
    });

    it('should restore source icon after toggling back to render mode', async () => {
      const markdown = `
# Test

\`\`\`mermaid
graph TD
A-->B
\`\`\`
`;

      const { container } = render(() => (
        <MarkdownView content={markdown} theme="light" />
      ));

      await waitFor(() => {
        expect(container.querySelector('.diagram-toggle-btn')).toBeTruthy();
      });

      const toggleBtn = container.querySelector('.diagram-toggle-btn') as HTMLButtonElement;

      // Toggle to source mode
      toggleBtn.click();

      await waitFor(() => {
        let iconSource = toggleBtn.querySelector('.icon-source') as SVGElement;
        let iconRender = toggleBtn.querySelector('.icon-render') as SVGElement;
        expect(iconSource.style.display).toBe('none');
        expect(iconRender.style.display).not.toBe('none');
      });

      // Toggle back to render mode
      toggleBtn.click();

      await waitFor(() => {
        const wrapper = container.querySelector('.code-block-wrapper') as HTMLDivElement;
        expect(wrapper.querySelector('.diagram-rendered')).toBeTruthy();
      }, { timeout: 5000 });

      // Re-query icons (DOM may have been recreated)
      const iconSource = toggleBtn.querySelector('.icon-source') as SVGElement;
      const iconRender = toggleBtn.querySelector('.icon-render') as SVGElement;

      // Should be back to render mode: source icon visible, render icon hidden
      expect(iconSource.style.display).not.toBe('none');
      expect(iconRender.style.display).toBe('none');
      expect(toggleBtn.title).toBe('查看源码');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty mermaid code block', async () => {
      const markdown = `
# Test

\`\`\`mermaid
\`\`\`
`;

      const { container } = render(() => (
        <MarkdownView content={markdown} theme="light" />
      ));

      await waitFor(() => {
        const wrapper = container.querySelector('.code-block-wrapper');
        expect(wrapper).toBeTruthy();
      });
    });

    it('should handle special characters in diagram code', async () => {
      const markdown = `
# Test

\`\`\`mermaid
graph TD
A["<b>Bold</b> & 'Quotes'"]-->B
\`\`\`
`;

      const { container } = render(() => (
        <MarkdownView content={markdown} theme="light" />
      ));

      await waitFor(() => {
        expect(container.querySelector('.code-block-wrapper')).toBeTruthy();
      });
    });

    it('should handle diagram code block with no language', async () => {
      const markdown = `
# Test

\`\`\`
some code
\`\`\`
`;

      const { container } = render(() => (
        <MarkdownView content={markdown} theme="light" />
      ));

      await waitFor(() => {
        const pre = container.querySelector('pre[data-lang="text"]');
        expect(pre).toBeTruthy();
        // No diagram buttons for unlabeled code blocks
        expect(container.querySelector('.diagram-toggle-btn')).toBeFalsy();
      });
    });

    it('should handle unknown diagram language gracefully', async () => {
      const markdown = `
# Test

\`\`\`unknownlang
some content
\`\`\`
`;

      const { container } = render(() => (
        <MarkdownView content={markdown} theme="light" />
      ));

      await waitFor(() => {
        const pre = container.querySelector('pre[data-lang="unknownlang"]');
        expect(pre).toBeTruthy();
        expect(container.querySelector('.diagram-toggle-btn')).toBeFalsy();
      });
    });

    it('should not crash when toggling rapidly', async () => {
      const markdown = `
# Test

\`\`\`mermaid
graph TD
A-->B
\`\`\`
`;

      const { container } = render(() => (
        <MarkdownView content={markdown} theme="light" />
      ));

      await waitFor(() => {
        expect(container.querySelector('.diagram-toggle-btn')).toBeTruthy();
      });

      const toggleBtn = container.querySelector('.diagram-toggle-btn') as HTMLButtonElement;

      // Rapid clicks should not throw
      for (let i = 0; i < 10; i++) {
        toggleBtn.click();
      }

      // Component should still be functional
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(container.querySelector('.diagram-toggle-btn')).toBeTruthy();
    });
  });
});