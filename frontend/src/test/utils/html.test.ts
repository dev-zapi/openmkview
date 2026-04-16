import { describe, it, expect } from 'vitest';
import { escapeHtml, unescapeHtml } from '../../utils/html';

describe('html utils', () => {
  it('escapes html entities', () => {
    expect(escapeHtml('<div>"x" & y</div>')).toBe('&lt;div&gt;&quot;x&quot; &amp; y&lt;/div&gt;');
  });

  it('unescapes html entities', () => {
    expect(unescapeHtml('&lt;div&gt;&quot;x&quot; &amp; y&lt;/div&gt;')).toBe('<div>"x" & y</div>');
  });
});
