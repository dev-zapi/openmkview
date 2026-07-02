import { describe, it, expect } from 'vitest';
import { getFileTypeCategory } from '../../utils/fileType';

describe('getFileTypeCategory', () => {
  describe('markdown files', () => {
    it('returns "markdown" for .md extension', () => {
      expect(getFileTypeCategory('test.md')).toBe('markdown');
    });

    it('returns "markdown" for .markdown extension', () => {
      expect(getFileTypeCategory('test.markdown')).toBe('markdown');
    });

    it('returns "markdown" for uppercase .MD extension', () => {
      expect(getFileTypeCategory('TEST.MD')).toBe('markdown');
    });

    it('returns "markdown" for mixed case extension', () => {
      expect(getFileTypeCategory('Test.Md')).toBe('markdown');
    });

    it('returns "markdown" for .MARKDOWN extension', () => {
      expect(getFileTypeCategory('README.MARKDOWN')).toBe('markdown');
    });
  });

  describe('HTML files', () => {
    it('returns "html" for .html extension', () => {
      expect(getFileTypeCategory('test.html')).toBe('html');
    });

    it('returns "html" for .htm extension', () => {
      expect(getFileTypeCategory('test.htm')).toBe('html');
    });

    it('returns "html" for uppercase .HTML extension', () => {
      expect(getFileTypeCategory('TEST.HTML')).toBe('html');
    });

    it('returns "html" for mixed case .Htm extension', () => {
      expect(getFileTypeCategory('Test.Htm')).toBe('html');
    });
  });

  describe('other files', () => {
    it('returns "other" for .txt extension', () => {
      expect(getFileTypeCategory('test.txt')).toBe('other');
    });

    it('returns "other" for files without extension', () => {
      expect(getFileTypeCategory('test')).toBe('other');
    });

    it('returns "other" for .jpg extension', () => {
      expect(getFileTypeCategory('test.jpg')).toBe('other');
    });

    it('returns "other" for .png extension', () => {
      expect(getFileTypeCategory('test.png')).toBe('other');
    });

    it('returns "other" for .pdf extension', () => {
      expect(getFileTypeCategory('document.pdf')).toBe('other');
    });

    it('returns "other" for .js extension', () => {
      expect(getFileTypeCategory('script.js')).toBe('other');
    });
  });

  describe('edge cases', () => {
    it('handles files with multiple dots', () => {
      expect(getFileTypeCategory('my.test.file.md')).toBe('markdown');
    });

    it('handles files with multiple dots and html', () => {
      expect(getFileTypeCategory('my.test.file.html')).toBe('html');
    });

    it('handles filenames with spaces', () => {
      expect(getFileTypeCategory('my document.md')).toBe('markdown');
    });

    it('handles filenames with special characters', () => {
      expect(getFileTypeCategory('test-file_v1.html')).toBe('html');
    });

    it('handles empty filename', () => {
      expect(getFileTypeCategory('')).toBe('other');
    });

    it('handles filename that is just an extension (hidden file)', () => {
      expect(getFileTypeCategory('.md')).toBe('markdown');
    });

    it('handles filename that is just .html (hidden file)', () => {
      expect(getFileTypeCategory('.html')).toBe('html');
    });
  });
});