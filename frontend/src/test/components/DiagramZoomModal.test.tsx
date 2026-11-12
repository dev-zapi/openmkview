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

  it('stops scheduling measure timers once open (no self-sustaining loop)', async () => {
    // Regression: the measure effect depended on zoom state, while measure()
    // itself writes zoom state — effect → setTimeout(0) → measure() → setState
    // → effect… an unbounded timer loop that kept churning the page forever,
    // even after the modal closed (progressive jank on mermaid zoom).
    const source = { type: 'mermaid' as const, code: 'graph TD\nA-->B', theme: 'light' as const };
    const { unmount } = render(() => (
      <DiagramZoomModal isOpen={true} onClose={vi.fn()} source={source} />
    ));

    await waitFor(() => expect(document.body.querySelector('.diagram-zoom-transform svg')).toBeTruthy());
    // Let the initial measurement settle.
    await new Promise((resolve) => setTimeout(resolve, 300));

    const spy = vi.spyOn(window, 'setTimeout');
    await new Promise((resolve) => setTimeout(resolve, 300));
    // With the bug the component re-schedules a 0ms measure timer ~250×/s;
    // healthy behaviour is at most a couple of stray scheduling calls.
    const zeroDelayCalls = spy.mock.calls.filter(([, delay]) => !delay).length;
    spy.mockRestore();
    expect(zeroDelayCalls).toBeLessThanOrEqual(2);
    unmount();
  });
});
