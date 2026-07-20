import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import OutlinePanel from '../components/OutlinePanel';

describe('OutlinePanel', () => {
  const mockHeadings = [
    { depth: 1, text: 'Introduction', id: 'introduction' },
    { depth: 2, text: 'Getting Started', id: 'getting-started' },
    { depth: 3, text: 'Installation', id: 'installation' },
  ];

  it('renders hidden panel when closed', () => {
    const { container } = render(() => (
      <OutlinePanel headings={mockHeadings} isOpen={false} onClose={() => {}} />
    ));
    const panel = container.querySelector('.outline-panel');
    expect(panel).toBeTruthy();
    expect(panel?.classList.contains('outline-panel-hidden')).toBe(true);
  });

  it('renders outline panel when open', () => {
    render(() => (
      <OutlinePanel headings={mockHeadings} isOpen={true} onClose={() => {}} />
    ));
    expect(screen.getByText('Outline')).toBeTruthy();
  });

  it('renders all headings', () => {
    render(() => (
      <OutlinePanel headings={mockHeadings} isOpen={true} onClose={() => {}} />
    ));
    expect(screen.getByText('Introduction')).toBeTruthy();
    expect(screen.getByText('Getting Started')).toBeTruthy();
    expect(screen.getByText('Installation')).toBeTruthy();
  });

  it('shows empty state when no headings', () => {
    render(() => (
      <OutlinePanel headings={[]} isOpen={true} onClose={() => {}} />
    ));
    expect(screen.getByText('No headings found')).toBeTruthy();
  });

  describe('auto-scroll suppression', () => {
    let scrollIntoViewSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      scrollIntoViewSpy = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoViewSpy;
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('calls scrollIntoView when activeHeadingId changes', async () => {
      const [activeId, setActiveId] = createSignal<string | null>(null);

      const { container } = render(() => (
        <OutlinePanel
          headings={mockHeadings}
          isOpen={true}
          onClose={() => {}}
          activeHeadingId={activeId()}
        />
      ));

      setActiveId('getting-started');
      await new Promise((r) => setTimeout(r, 0));

      expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
    });

    it('suppresses scrollIntoView after user wheel interaction', async () => {
      const [activeId, setActiveId] = createSignal<string | null>(null);

      const { container } = render(() => (
        <OutlinePanel
          headings={mockHeadings}
          isOpen={true}
          onClose={() => {}}
          activeHeadingId={activeId()}
        />
      ));

      const panelContent = container.querySelector('.outline-panel-content');
      expect(panelContent).toBeTruthy();

      fireEvent.wheel(panelContent!);

      setActiveId('getting-started');
      await new Promise((r) => setTimeout(r, 0));

      expect(scrollIntoViewSpy).not.toHaveBeenCalled();
    });

    it('resumes scrollIntoView after suppression window expires', async () => {
      vi.useFakeTimers();
      const [activeId, setActiveId] = createSignal<string | null>(null);

      const { container } = render(() => (
        <OutlinePanel
          headings={mockHeadings}
          isOpen={true}
          onClose={() => {}}
          activeHeadingId={activeId()}
        />
      ));

      const panelContent = container.querySelector('.outline-panel-content');
      fireEvent.wheel(panelContent!);

      setActiveId('getting-started');
      await vi.runAllTimersAsync();
      expect(scrollIntoViewSpy).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1100);

      setActiveId('installation');
      await vi.runAllTimersAsync();
      expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });
});