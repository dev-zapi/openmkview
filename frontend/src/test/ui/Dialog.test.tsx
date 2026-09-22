import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogFooter,
  DialogHeader,
} from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';

const TestDialog = (props: { onOpenChange?: (o: boolean) => void; open?: boolean }) => (
  <Dialog open={props.open} onOpenChange={props.onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>My Dialog</DialogTitle>
        <DialogDescription>Some description</DialogDescription>
      </DialogHeader>
      <p>Body content</p>
      <DialogFooter>
        <Button variant="outline">Cancel</Button>
        <Button>Save</Button>
      </DialogFooter>
      <DialogClose />
    </DialogContent>
  </Dialog>
);

describe('Dialog', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders content when open', () => {
    render(() => <TestDialog open={true} />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('My Dialog')).toBeTruthy();
    expect(screen.getByText('Some description')).toBeTruthy();
    expect(screen.getByText('Body content')).toBeTruthy();
  });

  it('renders nothing when closed', () => {
    render(() => <TestDialog open={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('My Dialog')).toBeNull();
    expect(document.querySelector('[data-dialog-overlay]')).toBeNull();
  });

  it('renders the overlay', () => {
    const { container } = render(() => <TestDialog open={true} />);
    // Overlay is portaled to document.body, so query the whole document.
    expect(document.querySelector('[data-dialog-overlay]')).toBeTruthy();
  });

  it('closes on Escape and calls onOpenChange', async () => {
    const onOpenChange = vi.fn();
    render(() => <TestDialog open={true} onOpenChange={onOpenChange} />);
    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes when the close button is clicked', () => {
    const onOpenChange = vi.fn();
    render(() => <TestDialog open={true} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes when the overlay is clicked', () => {
    const onOpenChange = vi.fn();
    render(() => <TestDialog open={true} onOpenChange={onOpenChange} />);
    fireEvent.click(document.querySelector('[data-dialog-overlay]')!);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not close when content is clicked', () => {
    const onOpenChange = vi.fn();
    render(() => <TestDialog open={true} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByText('Body content'));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('has aria-modal and the dialog role', () => {
    render(() => <TestDialog open={true} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('uses scaleIn animation classes', () => {
    render(() => <TestDialog open={true} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('animate-in');
  });

  it('accepts an extra class for legacy test contracts', () => {
    render(() => (
      <Dialog open={true}>
        <DialogContent class="my-legacy-class">x</DialogContent>
      </Dialog>
    ));
    expect(screen.getByRole('dialog').className).toContain('my-legacy-class');
  });
});
