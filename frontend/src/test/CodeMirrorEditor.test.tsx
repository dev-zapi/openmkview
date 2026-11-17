import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import CodeMirrorEditor from '../components/CodeMirrorEditor';
import { writingModeStore } from '../stores/writingModeStore';

describe('CodeMirrorEditor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    writingModeStore.reset();
  });

  afterEach(() => {
    document.documentElement.style.removeProperty('--editor-size');
    document.documentElement.style.removeProperty('--writing-font');
    document.documentElement.style.removeProperty('--writing-size');
    document.documentElement.style.removeProperty('--writing-width');
    vi.useRealTimers();
  });

  it('renders editor container', () => {
    const { container } = render(() => (
      <CodeMirrorEditor initialContent="# Hello World" fileName="test.md" />
    ));
    expect(container.querySelector('.codemirror-editor-container')).toBeTruthy();
  });

  it('applies the configured editor font size in dark mode', async () => {
    document.documentElement.style.setProperty('--editor-size', '24px');
    const { container } = render(() => (
      <CodeMirrorEditor initialContent="# Test" theme="dark" />
    ));

    await vi.runAllTimersAsync();

    const content = container.querySelector('.cm-content');
    expect(content).toBeTruthy();
    expect(getComputedStyle(content as Element).fontSize).toBe(
      'var(--editor-size, var(--code-size, 14px))',
    );
    expect(getComputedStyle(content as Element).getPropertyValue('--editor-size')).toBe('24px');
  });

  it('renders status bar with file name', () => {
    render(() => (
      <CodeMirrorEditor initialContent="# Test" fileName="example.md" />
    ));
    expect(screen.getByText('example.md')).toBeTruthy();
  });

  it('shows Untitled when no file name provided', () => {
    render(() => (
      <CodeMirrorEditor initialContent="# Test" />
    ));
    expect(screen.getByText('Untitled')).toBeTruthy();
  });

  it('shows dirty badge when isDirty is true', () => {
    render(() => (
      <CodeMirrorEditor initialContent="# Test" isDirty={true} />
    ));
    expect(screen.getByText('Modified')).toBeTruthy();
  });

  it('does not show dirty badge when isDirty is false', () => {
    const { container } = render(() => (
      <CodeMirrorEditor initialContent="# Test" isDirty={false} />
    ));
    const dirtyBadge = container.querySelector('.dirty-badge');
    expect(dirtyBadge).toBeFalsy();
  });

  it('shows save hint', () => {
    render(() => (
      <CodeMirrorEditor initialContent="# Test" />
    ));
    expect(screen.getByText('Ctrl+S to save')).toBeTruthy();
  });

  it('calls onDirtyChange when content changes', async () => {
    const onDirtyChange = vi.fn();
    const { container } = render(() => (
      <CodeMirrorEditor initialContent="# Test" onDirtyChange={onDirtyChange} />
    ));

    await vi.runAllTimersAsync();

    const editorContent = container.querySelector('.cm-content');
    if (editorContent) {
      fireEvent.input(editorContent, { target: { innerText: '# Updated' } });
    }
  });

  it('calls onSave when Ctrl+S is pressed', async () => {
    const onSave = vi.fn();
    const { container } = render(() => (
      <CodeMirrorEditor initialContent="# Test" onSave={onSave} />
    ));

    await vi.runAllTimersAsync();

    const editorEl = container.querySelector('.codemirror-editor-container');
    if (editorEl) {
      fireEvent.keyDown(editorEl, { key: 's', ctrlKey: true });
    }
  });

  describe('Writing Mode', () => {
    const markdownEditor = (container: HTMLElement) => {
      const content = container.querySelector('.cm-content');
      expect(content).toBeTruthy();
      return content as Element;
    };

    it('shows the Writing toggle for Markdown files in Edit view', async () => {
      render(() => (
        <CodeMirrorEditor
          initialContent="# Test"
          fileName="notes.md"
          filePath="notes/notes.md"
          fileType="markdown"
          projectId={1}
        />
      ));

      await vi.runAllTimersAsync();

      const toggle = screen.getByRole('button', { name: 'Writing' });
      expect(toggle).toBeTruthy();
      expect(toggle.getAttribute('aria-pressed')).toBe('false');
      // Shortcut label is cross-platform, matching the Search toolbar precedent.
      expect(toggle.getAttribute('title')).toContain('Ctrl+Alt+W');
      expect(toggle.getAttribute('title')).toContain('⌘+Alt+W');
    });

    it('never shows the Writing toggle for HTML files', async () => {
      render(() => (
        <CodeMirrorEditor
          initialContent="<p>Test</p>"
          fileName="page.html"
          filePath="page.html"
          fileType="html"
        />
      ));

      await vi.runAllTimersAsync();

      expect(screen.queryByRole('button', { name: 'Writing' })).toBeNull();
    });

    it('does not offer Typewriter or Focus sub-toggles in this ticket', async () => {
      render(() => (
        <CodeMirrorEditor
          initialContent="# Test"
          fileName="notes.md"
          filePath="notes/notes.md"
          fileType="markdown"
        />
      ));

      await vi.runAllTimersAsync();

      expect(screen.queryByRole('button', { name: 'Typewriter' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Focus' })).toBeNull();
    });

    it('toggles writing state for the current file when the button is clicked', async () => {
      render(() => (
        <CodeMirrorEditor
          initialContent="# Test"
          fileName="notes.md"
          filePath="notes/notes.md"
          fileType="markdown"
        />
      ));

      await vi.runAllTimersAsync();

      const toggle = screen.getByRole('button', { name: 'Writing' });
      fireEvent.click(toggle);

      expect(toggle.getAttribute('aria-pressed')).toBe('true');

      fireEvent.click(toggle);
      expect(toggle.getAttribute('aria-pressed')).toBe('false');
    });

    it('keeps the same file path isolated between projects', async () => {
      const editor = (projectId: number) => (
        <CodeMirrorEditor
          initialContent="# Test"
          fileName="README.md"
          filePath="README.md"
          fileType="markdown"
          projectId={projectId}
        />
      );

      const projectA = render(() => editor(1));
      await vi.runAllTimersAsync();
      fireEvent.click(screen.getByRole('button', { name: 'Writing' }));
      expect(screen.getByRole('button', { name: 'Writing' }).getAttribute('aria-pressed')).toBe('true');
      projectA.unmount();

      const projectB = render(() => editor(2));
      await vi.runAllTimersAsync();
      expect(screen.getByRole('button', { name: 'Writing' }).getAttribute('aria-pressed')).toBe('false');
      projectB.unmount();

      // Returning to project A resumes its own session state.
      render(() => editor(1));
      await vi.runAllTimersAsync();
      expect(screen.getByRole('button', { name: 'Writing' }).getAttribute('aria-pressed')).toBe('true');
    });

    it('restyles as centered serif prose and hides gutters when writing mode is on', async () => {
      const { container } = render(() => (
        <CodeMirrorEditor
          initialContent="# Test"
          fileName="notes.md"
          filePath="notes/notes.md"
          fileType="markdown"
        />
      ));

      await vi.runAllTimersAsync();

      // Code typography by default.
      const content = markdownEditor(container);
      expect(getComputedStyle(content).fontFamily).toContain('monospace');

      fireEvent.click(screen.getByRole('button', { name: 'Writing' }));
      await vi.runAllTimersAsync();

      expect(getComputedStyle(content).fontFamily).toContain('serif');
      expect(getComputedStyle(content).fontFamily).toContain('var(--writing-font');
      expect(getComputedStyle(content).fontSize).toContain('var(--writing-size');
      expect(getComputedStyle(content).maxWidth).toContain('var(--writing-width');

      const gutters = container.querySelector('.cm-gutters');
      expect(gutters).toBeTruthy();
      expect(getComputedStyle(gutters as Element).display).toBe('none');
    });

    it('applies writing typography in the dark theme too', async () => {
      writingModeStore.toggleWriting('1:notes/notes.md');

      const { container } = render(() => (
        <CodeMirrorEditor
          initialContent="# Test"
          fileName="notes.md"
          filePath="notes/notes.md"
          fileType="markdown"
          projectId={1}
          theme="dark"
        />
      ));

      await vi.runAllTimersAsync();

      const content = markdownEditor(container);
      expect(getComputedStyle(content).fontFamily).toContain('serif');
      expect(getComputedStyle(content).fontFamily).toContain('var(--writing-font');
      expect(getComputedStyle(content).fontSize).toContain('var(--writing-size');
      expect(getComputedStyle(content).maxWidth).toContain('var(--writing-width');
    });

    it('reads writing typography from the settings CSS variables', async () => {
      document.documentElement.style.setProperty('--writing-font', 'Arial, sans-serif');
      document.documentElement.style.setProperty('--writing-size', '21px');
      document.documentElement.style.setProperty('--writing-width', '70ch');

      const { container } = render(() => (
        <CodeMirrorEditor
          initialContent="# Test"
          fileName="notes.md"
          filePath="notes/notes.md"
          fileType="markdown"
        />
      ));

      await vi.runAllTimersAsync();
      fireEvent.click(screen.getByRole('button', { name: 'Writing' }));
      await vi.runAllTimersAsync();

      const content = markdownEditor(container);
      // CodeMirror themes emit the var() reference literally; the browser
      // resolves it against the custom properties applied by settings.
      expect(getComputedStyle(content).fontFamily).toContain('var(--writing-font');
      expect(getComputedStyle(content).fontSize).toContain('var(--writing-size');
      expect(getComputedStyle(content).maxWidth).toContain('var(--writing-width');
    });
  });
});
