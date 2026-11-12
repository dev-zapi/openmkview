import { describe, it, expect } from 'vitest';
import { render } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import CssEditor from '../components/CssEditor';

describe('CssEditor', () => {
  it('does not rebuild the editor when only the value changes', () => {
    const [settings, setSettings] = createSignal({ customStylesheet: '', theme: 'light' as const });
    const { container } = render(() => (
      <CssEditor
        value={settings().customStylesheet}
        theme={settings().theme}
        onChange={() => {}}
      />
    ));

    const editorBefore = container.querySelector('.cm-editor');

    // Mirrors a keystroke: the parent persists the new stylesheet while the theme is unchanged.
    setSettings({ customStylesheet: 'b', theme: 'light' });

    expect(container.querySelector('.cm-editor')).toBe(editorBefore);
  });
});
