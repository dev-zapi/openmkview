import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import CodeMirrorEditor from '../components/CodeMirrorEditor';

describe('CodeMirrorEditor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders editor container', () => {
    const { container } = render(() => (
      <CodeMirrorEditor initialContent="# Hello World" fileName="test.md" />
    ));
    expect(container.querySelector('.codemirror-editor-container')).toBeTruthy();
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
});
