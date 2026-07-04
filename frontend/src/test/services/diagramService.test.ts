import { describe, it, expect, vi } from 'vitest';
import { renderDiagram, isDiagramLanguage } from '../../services/diagramService';

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

describe('diagramService', () => {
  describe('isDiagramLanguage', () => {
    it('should return true for mermaid', () => {
      expect(isDiagramLanguage('mermaid')).toBe(true);
    });

    it('should return true for plantuml', () => {
      expect(isDiagramLanguage('plantuml')).toBe(true);
    });

    it('should return false for other languages', () => {
      expect(isDiagramLanguage('javascript')).toBe(false);
      expect(isDiagramLanguage('python')).toBe(false);
      expect(isDiagramLanguage('')).toBe(false);
    });
  });

  describe('renderDiagram', () => {
    it('should render mermaid diagram', async () => {
      const code = 'graph TD\nA-->B';
      const result = await renderDiagram('mermaid', code, 'light');
      expect(result).toContain('<svg');
    });

    it('should render plantuml diagram', async () => {
      const mockSvg = '<svg>test</svg>';
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockSvg),
      });

      const code = '@startuml\nA -> B\n@enduml';
      const result = await renderDiagram('plantuml', code, 'light');
      expect(result).toContain('<svg');
    });

    it('should throw error for unsupported diagram type', async () => {
      await expect(renderDiagram('unsupported' as any, 'code', 'light'))
        .rejects.toThrow('Unsupported diagram type');
    });
  });
});