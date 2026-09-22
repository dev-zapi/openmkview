import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { Button } from '../../components/ui/Button';

describe('Button', () => {
  it('renders children', () => {
    render(() => <Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeTruthy();
  });

  it('applies the default variant and size by default', () => {
    const { container } = render(() => <Button>x</Button>);
    const btn = container.querySelector('button')!;
    expect(btn.className).toContain('bg-primary');
    expect(btn.className).toContain('h-9');
  });

  it('applies variant classes', () => {
    const { container } = render(() => <Button variant="destructive">x</Button>);
    expect(container.querySelector('button')!.className).toContain('bg-destructive');
  });

  it('applies size classes', () => {
    const { container } = render(() => <Button size="icon">x</Button>);
    expect(container.querySelector('button')!.className).toContain('h-9 w-9');
  });

  it('merges a custom class', () => {
    const { container } = render(() => <Button class="my-extra">x</Button>);
    expect(container.querySelector('button')!.className).toContain('my-extra');
  });

  it('includes a focus-visible ring', () => {
    const { container } = render(() => <Button>x</Button>);
    expect(container.querySelector('button')!.className).toContain('focus-visible:ring-2');
  });

  it('forwards click handlers', () => {
    const onClick = vi.fn();
    render(() => <Button onClick={onClick}>x</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is disabled when disabled', () => {
    render(() => <Button disabled>x</Button>);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });
});
