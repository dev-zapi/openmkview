import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import IconPicker from '../components/IconPicker';

describe('IconPicker', () => {
  it('renders icon picker component', () => {
    const { container } = render(() => (
      <IconPicker currentIcon="📁" onIconChange={() => {}} onClose={() => {}} />
    ));
    expect(container.querySelector('.icon-picker')).toBeTruthy();
  });

  it('renders header with close button', () => {
    render(() => (
      <IconPicker currentIcon="📁" onIconChange={() => {}} onClose={() => {}} />
    ));
    expect(screen.getByText('Select Icon')).toBeTruthy();
    const closeBtn = screen.getByText('×');
    expect(closeBtn).toBeTruthy();
  });

  it('renders preset icon buttons', () => {
    const { container } = render(() => (
      <IconPicker currentIcon="📁" onIconChange={() => {}} onClose={() => {}} />
    ));
    const iconBtns = container.querySelectorAll('.icon-picker-icon');
    expect(iconBtns.length).toBeGreaterThan(0);
  });

  it('highlights active icon', () => {
    const { container } = render(() => (
      <IconPicker currentIcon="📁" onIconChange={() => {}} onClose={() => {}} />
    ));
    const activeBtn = container.querySelector('.icon-picker-icon.active');
    expect(activeBtn).toBeTruthy();
    expect(activeBtn?.textContent).toBe('📁');
  });

  it('calls onIconChange when icon clicked', () => {
    const onIconChange = vi.fn();
    const onClose = vi.fn();
    render(() => (
      <IconPicker currentIcon="📁" onIconChange={onIconChange} onClose={onClose} />
    ));
    
    const targetIcon = screen.getByText('📂');
    fireEvent.click(targetIcon);
    expect(onIconChange).toHaveBeenCalledWith('📂');
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(() => (
      <IconPicker currentIcon="📁" onIconChange={() => {}} onClose={onClose} />
    ));
    
    const closeBtn = screen.getByText('×');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows various icon categories', () => {
    render(() => (
      <IconPicker currentIcon="📁" onIconChange={() => {}} onClose={() => {}} />
    ));
    
    expect(screen.getByText('📁')).toBeTruthy();
    expect(screen.getByText('📝')).toBeTruthy();
    expect(screen.getByText('💻')).toBeTruthy();
    expect(screen.getByText('🚀')).toBeTruthy();
  });

  it('renders without currentIcon', () => {
    const { container } = render(() => (
      <IconPicker onIconChange={() => {}} onClose={() => {}} />
    ));
    const iconBtns = container.querySelectorAll('.icon-picker-icon');
    expect(iconBtns.length).toBeGreaterThan(0);
    
    const activeBtn = container.querySelector('.icon-picker-icon.active');
    expect(activeBtn).toBeFalsy();
  });
});