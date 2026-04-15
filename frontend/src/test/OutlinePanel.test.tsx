import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
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
});