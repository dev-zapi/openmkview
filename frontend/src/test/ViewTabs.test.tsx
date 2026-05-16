import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { ViewTabs } from '../components/markdown-header/ViewTabs';

describe('ViewTabs', () => {
  type TabType = 'preview' | 'source' | 'edit' | 'diff';

  it('renders all tabs for markdown files', async () => {
    const onTabChange = vi.fn();
    const { container } = render(() => (
      <ViewTabs activeTab="preview" onTabChange={onTabChange} fileType="markdown" />
    ));
    const tabs = container.querySelectorAll('button');
    expect(tabs.length).toBe(4);
    expect(screen.getByText('Preview')).toBeTruthy();
    expect(screen.getByText('Source')).toBeTruthy();
    expect(screen.getByText('Edit')).toBeTruthy();
    expect(screen.getByText('Diff')).toBeTruthy();
  });

  it('renders all tabs for html files', async () => {
    const onTabChange = vi.fn();
    const { container } = render(() => (
      <ViewTabs activeTab="preview" onTabChange={onTabChange} fileType="html" />
    ));
    const tabs = container.querySelectorAll('button');
    expect(tabs.length).toBe(4);
    expect(screen.getByText('Preview')).toBeTruthy();
    expect(screen.getByText('Source')).toBeTruthy();
    expect(screen.getByText('Edit')).toBeTruthy();
    expect(screen.getByText('Diff')).toBeTruthy();
  });

  it('shows only preview tab for image files', async () => {
    const onTabChange = vi.fn();
    const { container } = render(() => (
      <ViewTabs activeTab="preview" onTabChange={onTabChange} fileType="image" />
    ));
    const tabs = container.querySelectorAll('button');
    expect(tabs.length).toBe(1);
    expect(screen.getByText('Preview')).toBeTruthy();
  });

  it('highlights active tab', async () => {
    const onTabChange = vi.fn();
    const { container } = render(() => (
      <ViewTabs activeTab="edit" onTabChange={onTabChange} fileType="markdown" />
    ));
    const buttons = container.querySelectorAll('button');
    const editButton = Array.from(buttons).find(b => b.textContent?.includes('Edit'));
    expect(editButton).toBeTruthy();
    expect(editButton?.className).toMatch(/active/);
  });

  it('shows dirty indicator on edit tab when isDirty is true', async () => {
    const onTabChange = vi.fn();
    const { container } = render(() => (
      <ViewTabs activeTab="edit" onTabChange={onTabChange} fileType="markdown" isDirty={true} />
    ));
    const buttons = container.querySelectorAll('button');
    const editButton = Array.from(buttons).find(b => b.textContent?.includes('Edit'));
    expect(editButton?.textContent).toContain('*');
  });

  it('does not show dirty indicator when isDirty is false', async () => {
    const onTabChange = vi.fn();
    render(() => (
      <ViewTabs activeTab="edit" onTabChange={onTabChange} fileType="markdown" isDirty={false} />
    ));
    const editTab = screen.getByText('Edit').closest('button');
    const dirtyIndicator = editTab?.querySelector('.dirtyIndicator');
    expect(dirtyIndicator).toBeFalsy();
  });

  it('calls onTabChange when tab is clicked', async () => {
    const onTabChange = vi.fn();
    render(() => (
      <ViewTabs activeTab="preview" onTabChange={onTabChange} fileType="markdown" />
    ));
    const editButton = screen.getByText('Edit').closest('button');
    if (editButton) {
      fireEvent.click(editButton);
      expect(onTabChange).toHaveBeenCalledWith('edit');
    }
  });
});
