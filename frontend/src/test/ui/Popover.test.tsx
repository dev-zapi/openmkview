import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { Popover, PopoverTrigger, PopoverContent, PopoverClose } from '../../components/ui/Popover';

const TestPopover = (props: { onOpenChange?: (o: boolean) => void; open?: boolean }) => (
  <Popover open={props.open} onOpenChange={props.onOpenChange}>
    <PopoverTrigger>Toggle</PopoverTrigger>
    <PopoverContent>
      <p>Popover body</p>
      <PopoverClose />
    </PopoverContent>
  </Popover>
);

describe('Popover', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the trigger', () => {
    render(() => <TestPopover open={false} />);
    expect(screen.getByRole('button', { name: 'Toggle' })).toBeTruthy();
  });

  it('renders content when open', () => {
    render(() => <TestPopover open={true} />);
    expect(screen.getByText('Popover body')).toBeTruthy();
  });

  it('renders no content when closed', () => {
    render(() => <TestPopover open={false} />);
    expect(screen.queryByText('Popover body')).toBeNull();
  });

  it('toggles open when the trigger is clicked (uncontrolled)', () => {
    render(() => (
      <Popover defaultOpen={false}>
        <PopoverTrigger>Toggle</PopoverTrigger>
        <PopoverContent>Body</PopoverContent>
      </Popover>
    ));
    fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));
    expect(screen.getByText('Body')).toBeTruthy();
  });

  it('closes on Escape', () => {
    const onOpenChange = vi.fn();
    render(() => <TestPopover open={true} onOpenChange={onOpenChange} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes when the close button is clicked', () => {
    const onOpenChange = vi.fn();
    render(() => <TestPopover open={true} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes on an outside click', () => {
    const onOpenChange = vi.fn();
    render(() => (
      <div>
        <TestPopover open={true} onOpenChange={onOpenChange} />
        <button>Outside</button>
      </div>
    ));
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Outside' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not close when content is clicked', () => {
    const onOpenChange = vi.fn();
    render(() => <TestPopover open={true} onOpenChange={onOpenChange} />);
    fireEvent.mouseDown(screen.getByText('Popover body'));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('has the popover background and border classes', () => {
    render(() => <TestPopover open={true} />);
    const content = screen.getByRole('dialog');
    expect(content.className).toContain('bg-popover');
    expect(content.className).toContain('border-border');
    expect(content.className).toContain('rounded-lg');
  });
});
