import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';

describe('Input', () => {
  it('renders with a placeholder', () => {
    render(() => <Input placeholder="Type here" />);
    expect(screen.getByPlaceholderText('Type here')).toBeTruthy();
  });

  it('has the h-9 height and rounded-md radius', () => {
    const { container } = render(() => <Input />);
    const el = container.querySelector('input')!;
    expect(el.className).toContain('h-9');
    expect(el.className).toContain('rounded-md');
  });

  it('includes a focus-visible ring', () => {
    const { container } = render(() => <Input />);
    expect(container.querySelector('input')!.className).toContain('focus-visible:ring-2');
  });

  it('updates its value on input', () => {
    render(() => <Input placeholder="p" />);
    const el = screen.getByPlaceholderText('p') as HTMLInputElement;
    fireEvent.input(el, { target: { value: 'hello' } });
    expect(el.value).toBe('hello');
  });
});

describe('Select', () => {
  it('renders options', () => {
    render(() => (
      <Select>
        <option value="a">Alpha</option>
        <option value="b">Beta</option>
      </Select>
    ));
    expect(screen.getByRole('combobox')).toBeTruthy();
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
  });

  it('is styled with appearance-none and a chevron', () => {
    const { container } = render(() => <Select><option>x</option></Select>);
    const el = container.querySelector('select')!;
    expect(el.className).toContain('appearance-none');
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('changes value on selection', () => {
    render(() => (
      <Select>
        <option value="a">Alpha</option>
        <option value="b">Beta</option>
      </Select>
    ));
    const el = screen.getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(el, { target: { value: 'b' } });
    expect(el.value).toBe('b');
  });
});
