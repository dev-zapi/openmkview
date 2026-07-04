import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MermaidRenderer } from '../../services/mermaidService';

// Mock mermaid module
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockImplementation(async (id: string, code: string) => {
      // Simulate successful render for valid mermaid code
      if (code.includes('graph TD') || code.includes('graph LR')) {
        return { svg: `<svg id="${id}">mocked mermaid diagram</svg>` };
      }
      // Simulate error for invalid code
      throw new Error('Parse error on line 1');
    }),
  },
}));

describe('MermaidRenderer', () => {
  let renderer: MermaidRenderer;

  beforeEach(() => {
    renderer = new MermaidRenderer();
    vi.clearAllMocks();
  });

  describe('render', () => {
    it('should render simple flowchart', async () => {
      const code = 'graph TD\nA-->B';
      const result = await renderer.render(code, 'light');
      expect(result).toContain('<svg');
      expect(result).toContain('mocked mermaid diagram');
    });

    it('should render with dark theme', async () => {
      const code = 'graph TD\nA-->B';
      const result = await renderer.render(code, 'dark');
      expect(result).toContain('<svg');
    });

    it('should return error for invalid syntax', async () => {
      const invalidCode = 'invalid mermaid code';
      const result = await renderer.render(invalidCode, 'light');
      expect(result).toContain('Mermaid 渲染失败');
    });

    it('should return error for empty code', async () => {
      const result = await renderer.render('', 'light');
      expect(result).toContain('Mermaid 渲染失败');
    });
  });
});