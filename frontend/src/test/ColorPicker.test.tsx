import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import ColorPicker from '../components/ColorPicker';

describe('ColorPicker', () => {
  it('renders color picker component', () => {
    const { container } = render(() => (
      <ColorPicker currentColor="#FF6B6B" onColorChange={() => {}} onClose={() => {}} />
    ));
    expect(container.querySelector('.color-picker')).toBeTruthy();
  });

  it('renders header with close button', () => {
    render(() => (
      <ColorPicker currentColor="#FF6B6B" onColorChange={() => {}} onClose={() => {}} />
    ));
    expect(screen.getByText('Select Color')).toBeTruthy();
    const closeBtn = screen.getByText('×');
    expect(closeBtn).toBeTruthy();
  });

  it('renders preset color buttons', () => {
    const { container } = render(() => (
      <ColorPicker currentColor="#FF6B6B" onColorChange={() => {}} onClose={() => {}} />
    ));
    const presetBtns = container.querySelectorAll('.color-picker-preset');
    expect(presetBtns.length).toBeGreaterThan(0);
  });

  it('highlights active color', () => {
    const { container } = render(() => (
      <ColorPicker currentColor="#FF6B6B" onColorChange={() => {}} onClose={() => {}} />
    ));
    const activeBtn = container.querySelector('.color-picker-preset.active');
    expect(activeBtn).toBeTruthy();
    const bgColor = activeBtn?.style.background;
    expect(bgColor).toMatch(/#FF6B6B|rgb\(255, 107, 107\)/);
  });

  it('calls onColorChange when preset clicked', () => {
    const onColorChange = vi.fn();
    const onClose = vi.fn();
    const { container } = render(() => (
      <ColorPicker currentColor="#FF6B6B" onColorChange={onColorChange} onClose={onClose} />
    ));
    
    const presetBtns = container.querySelectorAll('.color-picker-preset');
    if (presetBtns.length >= 2) {
      fireEvent.click(presetBtns[1]);
      expect(onColorChange).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    }
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(() => (
      <ColorPicker currentColor="#FF6B6B" onColorChange={() => {}} onClose={onClose} />
    ));
    
    const closeBtn = screen.getByText('×');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows custom color toggle button initially', () => {
    render(() => (
      <ColorPicker currentColor="#FF6B6B" onColorChange={() => {}} onClose={() => {}} />
    ));
    expect(screen.getByText('Custom Color')).toBeTruthy();
  });

  it('shows custom color inputs after clicking toggle', () => {
    const { container } = render(() => (
      <ColorPicker currentColor="#FF6B6B" onColorChange={() => {}} onClose={() => {}} />
    ));
    
    const toggleBtn = screen.getByText('Custom Color');
    fireEvent.click(toggleBtn);
    
    const nativeInput = container.querySelector('input[type="color"]');
    const textInput = container.querySelector('input[type="text"]');
    expect(nativeInput).toBeTruthy();
    expect(textInput).toBeTruthy();
    expect(screen.getByText('Apply')).toBeTruthy();
  });

  it('calls onColorChange when custom color applied', () => {
    const onColorChange = vi.fn();
    const onClose = vi.fn();
    const { container } = render(() => (
      <ColorPicker currentColor="#FF6B6B" onColorChange={onColorChange} onClose={onClose} />
    ));
    
    fireEvent.click(screen.getByText('Custom Color'));
    
    const textInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    if (textInput) {
      fireEvent.input(textInput, { target: { value: '#ABCDEF' } });
    }
    
    fireEvent.click(screen.getByText('Apply'));
    expect(onColorChange).toHaveBeenCalledWith('#ABCDEF');
    expect(onClose).toHaveBeenCalled();
  });

  it('does not call onColorChange for invalid custom color', () => {
    const onColorChange = vi.fn();
    const onClose = vi.fn();
    const { container } = render(() => (
      <ColorPicker currentColor="#FF6B6B" onColorChange={onColorChange} onClose={onClose} />
    ));
    
    fireEvent.click(screen.getByText('Custom Color'));
    
    const textInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    if (textInput) {
      fireEvent.input(textInput, { target: { value: 'invalid' } });
    }
    
    fireEvent.click(screen.getByText('Apply'));
    expect(onColorChange).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});