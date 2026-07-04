import { describe, it, expect, vi } from 'vitest';
import { renderDiagram, isDiagramLanguage } from '../../services/diagramService';

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
    it('should throw error for unsupported diagram type', async () => {
      await expect(renderDiagram('unsupported', 'code', 'light'))
        .rejects.toThrow('Unsupported diagram type');
    });
  });
});