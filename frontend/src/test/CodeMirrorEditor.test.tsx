import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { EditorView } from '@codemirror/view';
import CodeMirrorEditor from '../components/CodeMirrorEditor';
import { writingModeStore } from '../stores/writingModeStore';

describe('CodeMirrorEditor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    writingModeStore.reset();
  });

  afterEach(() => {
    document.documentElement.style.removeProperty('--editor-size');
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

    const caretDocLine = (container: HTMLElement) => {
      const content = container.querySelector('.cm-content') as HTMLElement;
      const view = EditorView.findFromDOM(content);
      expect(view).toBeTruthy();
      return view!.state.doc.lineAt(view!.state.selection.main.head).number;
    };

    const moveCaret = (container: HTMLElement, lineNumber: number) => {
      const content = container.querySelector('.cm-content') as HTMLElement;
      const view = EditorView.findFromDOM(content);
      expect(view).toBeTruthy();
      view!.dispatch({ selection: { anchor: view!.state.doc.line(lineNumber).from } });
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

    it('does not offer the sub-toggles before Writing Mode is on', async () => {
      render(() => (
        <CodeMirrorEditor
          initialContent="# Test"
          fileName="notes.md"
          filePath="notes/notes.md"
          fileType="markdown"
        />
      ));

      await vi.runAllTimersAsync();

      expect(screen.queryByRole('button', { name: 'Focus' })).toBeNull();
      // Sub-toggles are only offered inside Writing Mode.
      expect(screen.queryByRole('button', { name: 'Typewriter' })).toBeNull();
    });

    it('shows the Typewriter sub-toggle when writing mode turns on, defaulting to on', async () => {
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

      fireEvent.click(screen.getByRole('button', { name: 'Writing' }));

      const typewriter = screen.getByRole('button', { name: 'Typewriter' });
      expect(typewriter.getAttribute('aria-pressed')).toBe('true');

      fireEvent.click(typewriter);
      expect(typewriter.getAttribute('aria-pressed')).toBe('false');

      fireEvent.click(typewriter);
      expect(typewriter.getAttribute('aria-pressed')).toBe('true');
    });

    it('remembers the typewriter preference across writing mode toggles', async () => {
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

      const writing = screen.getByRole('button', { name: 'Writing' });
      fireEvent.click(writing);
      fireEvent.click(screen.getByRole('button', { name: 'Typewriter' }));
      expect(screen.getByRole('button', { name: 'Typewriter' }).getAttribute('aria-pressed')).toBe('false');

      fireEvent.click(writing);
      expect(screen.queryByRole('button', { name: 'Typewriter' })).toBeNull();

      fireEvent.click(writing);
      expect(screen.getByRole('button', { name: 'Typewriter' }).getAttribute('aria-pressed')).toBe('false');
    });

    it('never shows the Typewriter sub-toggle for HTML files', async () => {
      render(() => (
        <CodeMirrorEditor
          initialContent="<p>Test</p>"
          fileName="page.html"
          filePath="page.html"
          fileType="html"
        />
      ));

      await vi.runAllTimersAsync();

      expect(screen.queryByRole('button', { name: 'Typewriter' })).toBeNull();
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

    it('keeps the caret where it was when Writing Mode is toggled', async () => {
      const { container } = render(() => (
        <CodeMirrorEditor
          initialContent={'first line\nsecond line\nthird line'}
          fileName="notes.md"
          filePath="notes/notes.md"
          fileType="markdown"
          theme="light"
        />
      ));

      await vi.runAllTimersAsync();

      moveCaret(container, 2);
      await vi.runAllTimersAsync();
      expect(caretDocLine(container)).toBe(2);

      // Turning Writing Mode on used to rebuild the editor and reset the caret.
      fireEvent.click(screen.getByRole('button', { name: 'Writing' }));
      await vi.runAllTimersAsync();
      expect(caretDocLine(container)).toBe(2);

      fireEvent.click(screen.getByRole('button', { name: 'Writing' }));
      await vi.runAllTimersAsync();
      expect(caretDocLine(container)).toBe(2);
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
      expect(getComputedStyle(content).maxWidth).toBe('65ch');

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
      expect(getComputedStyle(content).maxWidth).toBe('65ch');
    });

    describe('Paragraph Focus', () => {
      // Blank-line-delimited blocks: heading | two-line paragraph |
      // contiguous list | final paragraph.
      const DIM_DOC = [
        '# Heading',
        '',
        'First paragraph line one.',
        'First paragraph line two.',
        '',
        '- list item one',
        '- list item two',
        '- list item three',
        '',
        'Last paragraph.',
      ].join('\n');

      const editor = () => (
        <CodeMirrorEditor
          initialContent={DIM_DOC}
          fileName="notes.md"
          filePath="notes/notes.md"
          fileType="markdown"
          projectId={1}
          theme="light"
        />
      );

      const lineByText = (container: HTMLElement, text: string) => {
        const lines = Array.from(container.querySelectorAll('.cm-line'));
        return lines.find((line) => line.textContent === text);
      };

      const isDimmed = (container: HTMLElement, text: string) => {
        const line = lineByText(container, text);
        expect(line).toBeTruthy();
        return line!.classList.contains('cm-focus-dim');
      };

      const moveCaretToDocLine = (container: HTMLElement, lineNumber: number) => {
        const content = container.querySelector('.cm-content') as HTMLElement;
        const view = EditorView.findFromDOM(content);
        expect(view).toBeTruthy();
        view!.dispatch({ selection: { anchor: view!.state.doc.line(lineNumber).from } });
      };

      it('shows the Focus toggle, on by default, once Writing Mode is on', async () => {
        render(editor);
        await vi.runAllTimersAsync();

        fireEvent.click(screen.getByRole('button', { name: 'Writing' }));
        await vi.runAllTimersAsync();

        const focus = screen.getByRole('button', { name: 'Focus' });
        expect(focus.getAttribute('aria-pressed')).toBe('true');
        expect(focus.getAttribute('title')).toContain('Paragraph Focus');
      });

      it('dims every block except the one holding the caret', async () => {
        const { container } = render(editor);
        await vi.runAllTimersAsync();

        fireEvent.click(screen.getByRole('button', { name: 'Writing' }));
        await vi.runAllTimersAsync();

        // Caret starts in the heading block.
        expect(isDimmed(container, '# Heading')).toBe(false);
        expect(isDimmed(container, 'First paragraph line one.')).toBe(true);
        expect(isDimmed(container, 'First paragraph line two.')).toBe(true);
        expect(isDimmed(container, 'Last paragraph.')).toBe(true);
      });

      it('treats contiguous list lines as a single block', async () => {
        const { container } = render(editor);
        await vi.runAllTimersAsync();

        fireEvent.click(screen.getByRole('button', { name: 'Writing' }));
        await vi.runAllTimersAsync();

        // Move the caret into the middle of the list run.
        moveCaretToDocLine(container, 7);
        await vi.runAllTimersAsync();

        expect(isDimmed(container, '- list item one')).toBe(false);
        expect(isDimmed(container, '- list item two')).toBe(false);
        expect(isDimmed(container, '- list item three')).toBe(false);
        // Blocks around the list dim instead.
        expect(isDimmed(container, '# Heading')).toBe(true);
        expect(isDimmed(container, 'Last paragraph.')).toBe(true);
      });

      it('moves the highlight when the caret moves', async () => {
        const { container } = render(editor);
        await vi.runAllTimersAsync();

        fireEvent.click(screen.getByRole('button', { name: 'Writing' }));
        await vi.runAllTimersAsync();

        moveCaretToDocLine(container, 3);
        await vi.runAllTimersAsync();

        expect(isDimmed(container, 'First paragraph line one.')).toBe(false);
        expect(isDimmed(container, 'First paragraph line two.')).toBe(false);
        expect(isDimmed(container, '# Heading')).toBe(true);
        expect(isDimmed(container, 'Last paragraph.')).toBe(true);
      });

      it('keeps the caret where it was when Focus is toggled', async () => {
        const { container } = render(editor);
        await vi.runAllTimersAsync();

        fireEvent.click(screen.getByRole('button', { name: 'Writing' }));
        await vi.runAllTimersAsync();

        moveCaret(container, 3);
        await vi.runAllTimersAsync();
        expect(caretDocLine(container)).toBe(3);

        const focus = screen.getByRole('button', { name: 'Focus' });
        fireEvent.click(focus);
        await vi.runAllTimersAsync();
        expect(caretDocLine(container)).toBe(3);

        fireEvent.click(focus);
        await vi.runAllTimersAsync();
        expect(caretDocLine(container)).toBe(3);
      });

      it('keeps a block at full contrast when the caret sits on a blank line', async () => {
        const { container } = render(editor);
        await vi.runAllTimersAsync();

        fireEvent.click(screen.getByRole('button', { name: 'Writing' }));
        await vi.runAllTimersAsync();

        // Line 5 is the blank separator between the paragraph and the list.
        moveCaret(container, 5);
        await vi.runAllTimersAsync();

        // The nearest block stays readable instead of dimming the whole doc.
        expect(isDimmed(container, 'First paragraph line one.')).toBe(false);
        expect(isDimmed(container, 'First paragraph line two.')).toBe(false);
        expect(isDimmed(container, '- list item one')).toBe(true);
        expect(isDimmed(container, '# Heading')).toBe(true);
        expect(isDimmed(container, 'Last paragraph.')).toBe(true);
      });

      it('restores full contrast everywhere when Focus is turned off', async () => {
        const { container } = render(editor);
        await vi.runAllTimersAsync();

        fireEvent.click(screen.getByRole('button', { name: 'Writing' }));
        await vi.runAllTimersAsync();
        expect(container.querySelectorAll('.cm-focus-dim').length).toBeGreaterThan(0);

        const focus = screen.getByRole('button', { name: 'Focus' });
        fireEvent.click(focus);
        await vi.runAllTimersAsync();

        expect(focus.getAttribute('aria-pressed')).toBe('false');
        expect(container.querySelectorAll('.cm-focus-dim').length).toBe(0);
      });

      it('hides the Focus toggle again when Writing Mode is turned off', async () => {
        render(editor);
        await vi.runAllTimersAsync();

        fireEvent.click(screen.getByRole('button', { name: 'Writing' }));
        await vi.runAllTimersAsync();
        expect(screen.getByRole('button', { name: 'Focus' })).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Writing' }));
        await vi.runAllTimersAsync();
        expect(screen.queryByRole('button', { name: 'Focus' })).toBeNull();
      });
    });
  });
});
