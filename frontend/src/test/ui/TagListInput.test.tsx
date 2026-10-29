import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { TagListInput, splitTagListText } from '../../components/ui/TagListInput';

describe('TagListInput', () => {
  it('splits text on semicolons and commas', () => {
    expect(splitTagListText('a; b,c ,,d')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('renders one row per value with a delete button', () => {
    render(() => (
      <TagListInput values={['.DS_Store', 'Thumbs.db']} onChange={() => {}} addLabel="Ignored file" />
    ));

    expect(screen.getByDisplayValue('.DS_Store')).toBeTruthy();
    expect(screen.getByDisplayValue('Thumbs.db')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove .DS_Store' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove Thumbs.db' })).toBeTruthy();
  });

  it('adds a row when pressing Enter', () => {
    const onChange = vi.fn();
    render(() => <TagListInput values={['a']} onChange={onChange} addLabel="Item" />);

    const input = screen.getByRole('textbox', { name: 'Add Item' }) as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'b' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenLastCalledWith(['a', 'b']);
  });

  it('splits pasted text into multiple rows', () => {
    const onChange = vi.fn();
    render(() => <TagListInput values={[]} onChange={onChange} addLabel="Item" />);

    const input = screen.getByRole('textbox', { name: 'Add Item' });
    fireEvent.paste(input, {
      clipboardData: { getData: () => 'one;two,three' },
    });

    expect(onChange).toHaveBeenCalledWith(['one', 'two', 'three']);
  });

  it('removes a row via its delete button', () => {
    const onChange = vi.fn();
    render(() => <TagListInput values={['a', 'b']} onChange={onChange} addLabel="Item" />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove a' }));

    expect(onChange).toHaveBeenCalledWith(['b']);
  });

  it('edits an existing row', () => {
    const onChange = vi.fn();
    render(() => <TagListInput values={['a']} onChange={onChange} addLabel="Item" />);

    fireEvent.input(screen.getByDisplayValue('a'), { target: { value: 'changed' } });

    expect(onChange).toHaveBeenCalledWith(['changed']);
  });
});
