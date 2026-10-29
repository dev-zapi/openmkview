import { describe, expect, it } from 'vitest';
import {
  GENERIC_CODE_ICON,
  getFileIconCategory,
  getFileTreeIcons,
} from '../../utils/fileIconCategory';

describe('fileIconCategory', () => {
  it('classifies code extensions', () => {
    expect(getFileIconCategory('src/index.ts')).toBe('code');
    expect(getFileIconCategory('main.rs')).toBe('code');
    expect(getFileIconCategory('styles.scss')).toBe('code');
  });

  it('classifies config extensions', () => {
    expect(getFileIconCategory('package.json')).toBe('config');
    expect(getFileIconCategory('config.yaml')).toBe('config');
    expect(getFileIconCategory('Cargo.toml')).toBe('config');
    expect(getFileIconCategory('app.ini')).toBe('config');
  });

  it('classifies archive extensions', () => {
    expect(getFileIconCategory('bundle.zip')).toBe('archive');
    expect(getFileIconCategory('backup.tar')).toBe('archive');
    expect(getFileIconCategory('logs.gz')).toBe('archive');
  });

  it('classifies font extensions', () => {
    expect(getFileIconCategory('Inter.woff2')).toBe('font');
    expect(getFileIconCategory('font.ttf')).toBe('font');
  });

  it('falls back to the generic category', () => {
    expect(getFileIconCategory('LICENSE')).toBe('default');
    expect(getFileIconCategory('notes.xyz')).toBe('default');
  });

  it('exposes a built-in icon config', () => {
    const icons = getFileTreeIcons();
    expect(typeof icons).toBe('object');
    if (typeof icons === 'object') {
      expect(icons.set).toBe('complete');
      expect(icons.byFileExtension?.toml).toBe('json');
    }
  });

  it('maps code extensions the built-in set lacks to a code icon', () => {
    const icons = getFileTreeIcons();
    if (typeof icons !== 'object') throw new Error('expected icon config object');

    for (const fileName of ['main.c', 'App.java', 'index.php', 'script.lua', 'Main.kt', 'a.cs']) {
      const extension = fileName.split('.').pop()!;
      expect(getFileIconCategory(fileName)).toBe('code');
      expect(icons.byFileExtension?.[extension]).toBe(GENERIC_CODE_ICON);
    }
    expect(icons.spriteSheet).toContain(`id="${GENERIC_CODE_ICON}"`);
  });
});
