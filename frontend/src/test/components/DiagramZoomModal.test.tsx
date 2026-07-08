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
    const { container } = render(() => (
      <DiagramZoomModal isOpen={false} onClose={vi.fn()} source={null} />
    ));
    expect(container.querySelector('.diagram-zoom-overlay')).toBeFalsy();
  });

  it('renders SVG and zoom controls when open', async () => {
    const source = { type: 'mermaid' as const, code: 'graph TD\nA-->B', theme: 'light' as const };
    const { container } = render(() => (
      <DiagramZoomModal isOpen={true} onClose={vi.fn()} source={source} />
    ));

    await waitFor(() => expect(container.querySelector('.diagram-zoom-transform svg')).toBeTruthy());
    expect(container.querySelector('.diagram-zoom-scale')?.textContent).toBe('100%');
    expect(container.querySelector('[aria-label="放大"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="缩小"]')).toBeTruthy();
  });

  it('closes when overlay is clicked', async () => {
    const onClose = vi.fn();
    const source = { type: 'mermaid' as const, code: 'graph TD\nA-->B', theme: 'light' as const };
    const { container } = render(() => (
      <DiagramZoomModal isOpen={true} onClose={onClose} source={source} />
    ));

    await waitFor(() => expect(container.querySelector('.diagram-zoom-transform')).toBeTruthy());
    const overlay = container.querySelector('.diagram-zoom-overlay')!;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('increases scale when zoom in button is clicked', async () => {
    const source = { type: 'mermaid' as const, code: 'graph TD\nA-->B', theme: 'light' as const };
    const { container } = render(() => (
      <DiagramZoomModal isOpen={true} onClose={vi.fn()} source={source} />
    ));

    await waitFor(() => expect(container.querySelector('.diagram-zoom-transform')).toBeTruthy());
    expect(container.querySelector('.diagram-zoom-scale')?.textContent).toBe('100%');

    fireEvent.click(container.querySelector('[aria-label="放大"]')!);
    await waitFor(() => {
      const text = container.querySelector('.diagram-zoom-scale')?.textContent ?? '';
      expect(text).not.toBe('100%');
    });
  });
});
