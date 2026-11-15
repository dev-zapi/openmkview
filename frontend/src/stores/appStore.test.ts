import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { appStore, MOBILE_SHELL_MEDIA } from './appStore';

describe('appStore mobile shell detection', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('exports a media list with both the width arm and the landscape-phone arm', () => {
    // ≤768px catches portrait phones and the 768px boundary itself;
    // the second arm catches a phone rotated landscape (wider than 768, ≤500px tall, touch).
    expect(MOBILE_SHELL_MEDIA).toContain('(max-width: 768px)');
    expect(MOBILE_SHELL_MEDIA).toContain('(max-height: 500px) and (pointer: coarse)');
  });

  it('switches isMobile from the shared media query result', () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: true, media: MOBILE_SHELL_MEDIA });
    vi.stubGlobal('matchMedia', matchMedia);

    appStore.checkMobile();
    expect(matchMedia).toHaveBeenCalledWith(MOBILE_SHELL_MEDIA);
    expect(appStore.isMobile()).toBe(true);

    matchMedia.mockReturnValue({ matches: false, media: MOBILE_SHELL_MEDIA });
    appStore.checkMobile();
    expect(appStore.isMobile()).toBe(false);
  });

  it('keeps the index.css mobile gate in sync with MOBILE_SHELL_MEDIA', () => {
    // CSS cannot import the constant, so a drift guard test is the sync mechanism.
    const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
    const gate = `@media ${MOBILE_SHELL_MEDIA} {`;
    expect(css).toContain(gate);
  });
});
