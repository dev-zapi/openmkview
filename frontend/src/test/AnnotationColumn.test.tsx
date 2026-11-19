import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import AnnotationColumn from '../components/AnnotationColumn';

describe('AnnotationColumn', () => {
  it('renders the persisted desktop width and starts dragging from its divider', () => {
    const onStartDragging = vi.fn();
    const { container } = render(() => (
      <AnnotationColumn
        isOpen={true}
        onClose={() => {}}
        width={360}
        transition="none"
        onStartDragging={onStartDragging}
      />
    ));

    const panel = container.querySelector<HTMLElement>('.annotation-column');
    expect(panel?.style.width).toBe('360px');
    expect(panel?.style.transition).toBe('none');

    const handle = container.querySelector('.annotation-column-resize-handle');
    expect(handle).toBeTruthy();
    fireEvent.mouseDown(handle!);
    expect(onStartDragging).toHaveBeenCalledTimes(1);
  });

  it('omits the resize handle in the mobile drawer', () => {
    const { container } = render(() => (
      <AnnotationColumn isOpen={true} onClose={() => {}} width="100%" />
    ));

    const panel = container.querySelector<HTMLElement>('.annotation-column');
    expect(panel?.style.width).toBe('100%');
    expect(container.querySelector('.annotation-column-resize-handle')).toBeNull();
  });
});
