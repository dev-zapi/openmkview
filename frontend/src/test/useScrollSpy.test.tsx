import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { createSignal, Component } from 'solid-js';
import { useScrollSpy } from '../hooks/useScrollSpy';
import type { Heading } from '../types';

describe('useScrollSpy', () => {
  const mockHeadings: Heading[] = [
    { depth: 1, text: 'Introduction', id: 'introduction' },
    { depth: 2, text: 'Getting Started', id: 'getting-started' },
  ];

  let observeCount: number;
  let disconnectCount: number;
  let unobserveCount: number;

  beforeEach(() => {
    observeCount = 0;
    disconnectCount = 0;
    unobserveCount = 0;

    document.body.innerHTML = `
      <div class="content-main">
        <h1 id="introduction">Introduction</h1>
        <h2 id="getting-started">Getting Started</h2>
      </div>
    `;

    class MockIntersectionObserver {
      observe = vi.fn(() => observeCount++);
      unobserve = vi.fn(() => unobserveCount++);
      disconnect = vi.fn(() => disconnectCount++);
      constructor() {}
    }

    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  });

  const TestComponent: Component<{ headings: Heading[] }> = (props) => {
    const { activeHeadingId } = useScrollSpy(() => props.headings, () => true);
    return <div data-testid="active">{activeHeadingId() || 'none'}</div>;
  };

  it('creates observer on initial render', () => {
    render(() => <TestComponent headings={mockHeadings} />);
    expect(observeCount).toBe(2);
    expect(disconnectCount).toBe(0);
  });

  it('does not rebuild observer when headings content is unchanged', async () => {
    const [headings, setHeadings] = createSignal<Heading[]>(mockHeadings);

    render(() => <TestComponent headings={headings()} />);
    expect(observeCount).toBe(2);
    expect(disconnectCount).toBe(0);

    const newHeadingsRef = [...mockHeadings];
    setHeadings(newHeadingsRef);
    await new Promise((r) => setTimeout(r, 0));

    expect(disconnectCount).toBe(0);
    expect(observeCount).toBe(2);
  });

  it('rebuilds observer when headings content changes', async () => {
    const [headings, setHeadings] = createSignal<Heading[]>(mockHeadings);

    render(() => <TestComponent headings={headings()} />);
    expect(observeCount).toBe(2);
    expect(disconnectCount).toBe(0);

    document.body.innerHTML = `
      <div class="content-main">
        <h1 id="new-section">New Section</h1>
      </div>
    `;

    const differentHeadings: Heading[] = [
      { depth: 1, text: 'New Section', id: 'new-section' },
    ];
    setHeadings(differentHeadings);
    await new Promise((r) => setTimeout(r, 0));

    expect(disconnectCount).toBe(1);
    expect(observeCount).toBe(3);
  });

  describe('lockForProgrammaticScroll', () => {
    let observerCallback: ((entries: any[]) => void) | null = null;

    beforeEach(() => {
      observerCallback = null;

      class MockIntersectionObserver {
        observe = vi.fn(() => observeCount++);
        unobserve = vi.fn(() => unobserveCount++);
        disconnect = vi.fn(() => disconnectCount++);
        constructor(callback: (entries: any[]) => void) {
          observerCallback = callback;
        }
      }

      vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
    });

    it('sets active heading immediately when locked', () => {
      const TestLockComponent: Component = () => {
        const { activeHeadingId, lockForProgrammaticScroll } = useScrollSpy(
          () => mockHeadings,
          () => true,
        );
        return (
          <div>
            <button data-testid="lock" onClick={() => lockForProgrammaticScroll('getting-started')}>
              Lock
            </button>
            <span data-testid="active">{activeHeadingId() || 'none'}</span>
          </div>
        );
      };

      render(() => <TestLockComponent />);
      expect(screen.getByTestId('active').textContent).toBe('none');

      fireEvent.click(screen.getByTestId('lock'));
      expect(screen.getByTestId('active').textContent).toBe('getting-started');
    });

    it('suppresses scroll-spy updates while locked', async () => {
      const TestLockComponent: Component = () => {
        const { activeHeadingId, lockForProgrammaticScroll } = useScrollSpy(
          () => mockHeadings,
          () => true,
        );
        return (
          <div>
            <button data-testid="lock" onClick={() => lockForProgrammaticScroll('getting-started')}>
              Lock
            </button>
            <span data-testid="active">{activeHeadingId() || 'none'}</span>
          </div>
        );
      };

      render(() => <TestLockComponent />);
      fireEvent.click(screen.getByTestId('lock'));

      expect(observerCallback).toBeTruthy();
      observerCallback!([
        { target: { id: 'introduction' }, isIntersecting: true },
        { target: { id: 'getting-started' }, isIntersecting: false },
      ]);
      await new Promise((r) => setTimeout(r, 0));

      expect(screen.getByTestId('active').textContent).toBe('getting-started');
    });

    it('releases lock when scrollend event fires', async () => {
      const TestLockComponent: Component = () => {
        const { activeHeadingId, lockForProgrammaticScroll } = useScrollSpy(
          () => mockHeadings,
          () => true,
        );
        return (
          <div>
            <button data-testid="lock" onClick={() => lockForProgrammaticScroll('getting-started')}>
              Lock
            </button>
            <span data-testid="active">{activeHeadingId() || 'none'}</span>
          </div>
        );
      };

      render(() => <TestLockComponent />);
      fireEvent.click(screen.getByTestId('lock'));

      const contentMain = document.querySelector('.content-main');
      contentMain!.dispatchEvent(new Event('scrollend'));
      await new Promise((r) => setTimeout(r, 0));

      expect(observerCallback).toBeTruthy();
      observerCallback!([
        { target: { id: 'introduction' }, isIntersecting: true },
        { target: { id: 'getting-started' }, isIntersecting: false },
      ]);
      await new Promise((r) => setTimeout(r, 0));

      expect(screen.getByTestId('active').textContent).toBe('introduction');
    });
  });
});
