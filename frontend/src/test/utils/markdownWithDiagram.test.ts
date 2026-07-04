import { describe, it, expect } from 'vitest';
import { isDiagramLanguage } from '../../utils/markdown';

describe('markdown diagram utilities', () => {
  describe('isDiagramLanguage', () => {
    it('should detect mermaid language', () => {
      expect(isDiagramLanguage('mermaid')).toBe(true);
    });

    it('should detect plantuml language', () => {
      expect(isDiagramLanguage('plantuml')).toBe(true);
    });

    it('should not detect other languages', () => {
      expect(isDiagramLanguage('javascript')).toBe(false);
      expect(isDiagramLanguage('typescript')).toBe(false);
      expect(isDiagramLanguage('')).toBe(false);
    });
  });
});