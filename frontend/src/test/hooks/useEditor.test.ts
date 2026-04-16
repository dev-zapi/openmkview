import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useEditor } from '../../hooks/useEditor';
import { editorStore } from '../../stores/editorStore';
import { fileStore } from '../../stores/fileStore';
import { projectStore } from '../../stores/projectStore';
import { appStore } from '../../stores/appStore';

describe('useEditor', () => {
  beforeEach(() => {
    editorStore.reset();
    fileStore.reset();
    appStore.setActiveTab('preview');
    projectStore.setActiveProject(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('updates editor content and dirty state', () => {
    const { handleContentChange } = useEditor();
    editorStore.initialize('original');

    handleContentChange('changed');

    expect(editorStore.editContent()).toBe('changed');
    expect(editorStore.isDirty()).toBe(true);
  });

  it('changes tab immediately when editor is clean', () => {
    const { changeTab } = useEditor();

    changeTab('edit');

    expect(appStore.activeTab()).toBe('edit');
  });

  it('keeps current tab when unsaved changes are rejected', () => {
    const { changeTab } = useEditor();
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(false);
    appStore.setActiveTab('edit');
    editorStore.initialize('original');
    editorStore.updateContent('changed');

    changeTab('preview');

    expect(confirmMock).toHaveBeenCalled();
    expect(appStore.activeTab()).toBe('edit');
  });

  it('switches tab when unsaved changes are confirmed', () => {
    const { changeTab } = useEditor();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    appStore.setActiveTab('edit');
    editorStore.initialize('original');
    editorStore.updateContent('changed');

    changeTab('preview');

    expect(appStore.activeTab()).toBe('preview');
  });

  it('stores extracted headings', () => {
    const { handleHeadingsExtracted } = useEditor();
    const headings = [{ depth: 1, text: 'Title', id: 'title' }];

    handleHeadingsExtracted(headings);

    expect(fileStore.extractedHeadings()).toEqual(headings);
  });
});
