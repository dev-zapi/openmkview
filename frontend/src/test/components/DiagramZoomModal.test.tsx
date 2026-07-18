import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@solidjs/testing-library';
import DiagramZoomModal from '../../components/DiagramZoomModal';

vi.mock('../../services/diagramZoomService', () => ({
  renderZoomDiagram: vi.fn().mockResolvedValue(
    '<svg viewBox="0 0 100 100"><rect width="100" height="100"/></svg>'
  ),
}));

describe('DiagramZoomModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when closed', () => {
    const { unmount } = render(() => (
      <DiagramZoomModal isOpen={false} onClose={vi.fn()} source={null} />
    ));
    expect(document.body.querySelector('.diagram-zoom-overlay')).toBeFalsy();
    unmount();
  });

  it('renders SVG and zoom controls when open', async () => {
    const source = { type: 'mermaid' as const, code: 'graph TD\nA-->B', theme: 'light' as const };
    const { unmount } = render(() => (
      <DiagramZoomModal isOpen={true} onClose={vi.fn()} source={source} />
    ));

    await waitFor(() => expect(document.body.querySelector('.diagram-zoom-transform svg')).toBeTruthy());
    expect(document.body.querySelector('.diagram-zoom-scale')?.textContent).toBe('100%');
    expect(document.body.querySelector('[aria-label="放大"]')).toBeTruthy();
    expect(document.body.querySelector('[aria-label="缩小"]')).toBeTruthy();
    unmount();
  });

  it('closes when overlay is clicked', async () => {
    const onClose = vi.fn();
    const source = { type: 'mermaid' as const, code: 'graph TD\nA-->B', theme: 'light' as const };
    const { unmount } = render(() => (
      <DiagramZoomModal isOpen={true} onClose={onClose} source={source} />
    ));

    await waitFor(() => expect(document.body.querySelector('.diagram-zoom-transform')).toBeTruthy());
    const overlay = document.body.querySelector('.diagram-zoom-overlay')!;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('increases scale when zoom in button is clicked', async () => {
    const source = { type: 'mermaid' as const, code: 'graph TD\nA-->B', theme: 'light' as const };
    const { unmount } = render(() => (
      <DiagramZoomModal isOpen={true} onClose={vi.fn()} source={source} />
    ));

    await waitFor(() => expect(document.body.querySelector('.diagram-zoom-transform')).toBeTruthy());
    expect(document.body.querySelector('.diagram-zoom-scale')?.textContent).toBe('100%');

    fireEvent.click(document.body.querySelector('[aria-label="放大"]')!);
    await waitFor(() => {
      const text = document.body.querySelector('.diagram-zoom-scale')?.textContent ?? '';
      expect(text).not.toBe('100%');
    });
    unmount();
  });
});
