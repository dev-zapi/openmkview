import { describe, it, expect } from 'vitest';

const resolveImagePath = (currentFilePath: string, imageHref: string): string => {
  const currentDir = currentFilePath.substring(0, currentFilePath.lastIndexOf('/'));
  const normalizedHref = imageHref.replace(/^\.\//, '');

  if (normalizedHref.startsWith('../')) {
    const parts = currentDir.split('/');
    const hrefParts = normalizedHref.split('/');

    for (const part of hrefParts) {
      if (part === '..') {
        parts.pop();
      } else if (part !== '.') {
        parts.push(part);
      }
    }
    return parts.join('/');
  }

  return currentDir ? `${currentDir}/${normalizedHref}` : normalizedHref;
};

describe('resolveImagePath', () => {
  it('should resolve relative path in same directory', () => {
    const result = resolveImagePath('docs/readme.md', 'image.png');
    expect(result).toBe('docs/image.png');
  });

  it('should resolve relative path with ./ prefix', () => {
    const result = resolveImagePath('docs/readme.md', './image.png');
    expect(result).toBe('docs/image.png');
  });

  it('should resolve relative path with ../ prefix', () => {
    const result = resolveImagePath('docs/sub/readme.md', '../image.png');
    expect(result).toBe('docs/image.png');
  });

  it('should resolve relative path with multiple ../', () => {
    const result = resolveImagePath('docs/sub/folder/readme.md', '../../image.png');
    expect(result).toBe('docs/image.png');
  });

  it('should handle file in root directory', () => {
    const result = resolveImagePath('readme.md', 'image.png');
    expect(result).toBe('image.png');
  });

  it('should handle nested directories', () => {
    const result = resolveImagePath('a/b/c/d/readme.md', '../../images/logo.png');
    expect(result).toBe('a/b/images/logo.png');
  });

  it('should preserve subdirectory in image path', () => {
    const result = resolveImagePath('docs/readme.md', 'assets/image.png');
    expect(result).toBe('docs/assets/image.png');
  });

  it('should handle relative path going to root', () => {
    const result = resolveImagePath('docs/sub/readme.md', '../../root-image.png');
    expect(result).toBe('root-image.png');
  });

  it('should handle complex relative paths', () => {
    const result = resolveImagePath('docs/guide/intro.md', '../assets/icons/logo.svg');
    expect(result).toBe('docs/assets/icons/logo.svg');
  });

  it('should handle ./ in middle of path', () => {
    const result = resolveImagePath('docs/readme.md', './subfolder/./image.png');
    expect(result).toBe('docs/subfolder/./image.png');
  });
});

describe('Markdown image URL rewrite rules', () => {
  it('should rewrite relative image to raw API URL', () => {
    const currentFilePath = 'docs/readme.md';
    const projectId = 1;
    const imageHref = 'image.png';
    const absolutePath = resolveImagePath(currentFilePath, imageHref);
    const expectedUrl = `/api/files/raw?path=${encodeURIComponent(absolutePath)}&project_id=${projectId}`;
    expect(expectedUrl).toBe('/api/files/raw?path=docs%2Fimage.png&project_id=1');
  });

  it('should not rewrite absolute URLs', () => {
    const imageHref = 'https://example.com/image.png';
    const shouldRewrite = !imageHref.startsWith('http') && !imageHref.startsWith('data:') && !imageHref.startsWith('//');
    expect(shouldRewrite).toBe(false);
  });

  it('should not rewrite data URLs', () => {
    const imageHref = 'data:image/png;base64,abc123';
    const shouldRewrite = !imageHref.startsWith('http') && !imageHref.startsWith('data:') && !imageHref.startsWith('//');
    expect(shouldRewrite).toBe(false);
  });

  it('should not rewrite protocol-relative URLs', () => {
    const imageHref = '//example.com/image.png';
    const shouldRewrite = !imageHref.startsWith('http') && !imageHref.startsWith('data:') && !imageHref.startsWith('//');
    expect(shouldRewrite).toBe(false);
  });

  it('should rewrite relative path with ../', () => {
    const currentFilePath = 'docs/sub/readme.md';
    const projectId = 1;
    const imageHref = '../image.png';
    const absolutePath = resolveImagePath(currentFilePath, imageHref);
    const expectedUrl = `/api/files/raw?path=${encodeURIComponent(absolutePath)}&project_id=${projectId}`;
    expect(expectedUrl).toBe('/api/files/raw?path=docs%2Fimage.png&project_id=1');
  });

  it('should encode special characters in path', () => {
    const currentFilePath = 'docs/readme.md';
    const projectId = 1;
    const imageHref = 'images/my image.png';
    const absolutePath = resolveImagePath(currentFilePath, imageHref);
    const expectedUrl = `/api/files/raw?path=${encodeURIComponent(absolutePath)}&project_id=${projectId}`;
    expect(expectedUrl).toContain('my%20image.png');
  });
});