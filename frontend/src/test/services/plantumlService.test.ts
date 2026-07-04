import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlantUMLRenderer } from '../../services/plantumlService';

// Mock fetch for testing
global.fetch = vi.fn();

describe('PlantUMLRenderer', () => {
  let renderer: PlantUMLRenderer;

  beforeEach(() => {
    renderer = new PlantUMLRenderer();
    vi.clearAllMocks();
  });

  describe('encodePlantUML', () => {
    it('should encode PlantUML code correctly', () => {
      const code = '@startuml\nA -> B\n@enduml';
      const encoded = renderer.encodePlantUML(code);
      expect(encoded).toBeTruthy();
      expect(encoded.length).toBeGreaterThan(0);
    });
  });

  describe('render', () => {
    it('should return error for missing @startuml/@enduml', async () => {
      const invalidCode = 'A -> B';
      const result = await renderer.render(invalidCode, 'light');
      expect(result).toContain('PlantUML 语法错误');
    });

    it('should return error for empty code', async () => {
      const result = await renderer.render('', 'light');
      expect(result).toContain('PlantUML 渲染失败');
    });

    it('should fetch SVG from PlantUML server', async () => {
      const mockSvg = '<svg>test</svg>';
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockSvg),
      });

      const code = '@startuml\nA -> B\n@enduml';
      const result = await renderer.render(code, 'light');
      expect(result).toBe(mockSvg);
    });

    it('should handle network error', async () => {
      (global.fetch as any).mockRejectedValueOnce(new TypeError('Network error'));

      const code = '@startuml\nA -> B\n@enduml';
      const result = await renderer.render(code, 'light');
      expect(result).toContain('PlantUML 服务器连接失败');
    });
  });
});