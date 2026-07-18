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

    it('should hide zoom button in diagram mode', async () => {
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

      // Initially in render mode, zoom should be hidden
      await waitFor(() => {
        expect(zoomBtn.style.display).toBe('none');
      });

      // Switch to source mode
      toggleBtn.click();

      await waitFor(() => {
        expect(zoomBtn.style.display).toBe('');
      });

      // Switch back to render mode
      toggleBtn.click();

      await waitFor(() => {
        expect(zoomBtn.style.display).toBe('none');
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
});