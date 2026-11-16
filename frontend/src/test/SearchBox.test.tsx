import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { SearchBox } from '../components/markdown-header/SearchBox';

const baseProps = {
  query: '',
  onQueryChange: () => {},
  onClose: () => {},
  onNextResult: () => {},
  onPrevResult: () => {},
};

describe('SearchBox', () => {
  // Regression: an early `return null` on !isOpen froze the component closed
  // forever (Solid component bodies run once). It must react to isOpen flips.
  it('stays hidden when closed and opens reactively when isOpen flips true', async () => {
    const [isOpen, setIsOpen] = createSignal(false);
    render(() => <SearchBox {...baseProps} isOpen={isOpen()} />);

    expect(screen.queryByRole('search')).toBeNull();

    setIsOpen(true);
    expect(await screen.findByRole('search')).toBeTruthy();

    setIsOpen(false);
    expect(screen.queryByRole('search')).toBeNull();
  });

  it('shows the result counter and enables nav buttons when there are results', async () => {
    render(() => (
      <SearchBox {...baseProps} isOpen={true} query="abc" resultCount={3} currentResult={2} />
    ));
    expect(screen.getByText('2/3')).toBeTruthy();
    expect((screen.getByTitle('Previous match (Shift+Enter)') as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByTitle('Next match (Enter)') as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows no-match text and disables nav buttons when a query has no matches', async () => {
    render(() => (
      <SearchBox {...baseProps} isOpen={true} query="zzz" resultCount={0} currentResult={0} />
    ));
    expect(screen.getByText('No matches')).toBeTruthy();
    expect((screen.getByTitle('Previous match (Shift+Enter)') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTitle('Next match (Enter)') as HTMLButtonElement).disabled).toBe(true);
  });

  it('emits onQueryChange when typing', async () => {
    const onQueryChange = vi.fn();
    render(() => <SearchBox {...baseProps} isOpen={true} onQueryChange={onQueryChange} />);
    const input = screen.getByPlaceholderText('Search…');
    fireEvent.input(input, { target: { value: 'hello' } });
    expect(onQueryChange).toHaveBeenCalledWith('hello');
  });

  it('emits onClose / onNextResult / onPrevResult from the buttons', async () => {
    const onClose = vi.fn();
    const onNextResult = vi.fn();
    const onPrevResult = vi.fn();
    render(() => (
      <SearchBox
        {...baseProps}
        isOpen={true}
        query="abc"
        resultCount={2}
        currentResult={1}
        onClose={onClose}
        onNextResult={onNextResult}
        onPrevResult={onPrevResult}
      />
    ));
    fireEvent.click(screen.getByTitle('Next match (Enter)'));
    expect(onNextResult).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTitle('Previous match (Shift+Enter)'));
    expect(onPrevResult).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTitle('Close (ESC)'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
