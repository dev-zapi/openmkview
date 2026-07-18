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
});