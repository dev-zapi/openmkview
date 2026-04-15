import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import ImagePreview from '../components/ImagePreview';

describe('ImagePreview', () => {
  it('renders image element even during loading state', () => {
    const { container } = render(() => (
      <ImagePreview src="/test-image.png" fileName="test.png" />
    ));
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toBe('/test-image.png');
  });

  it('shows loading overlay initially', () => {
    const { container } = render(() => (
      <ImagePreview src="/test-image.png" fileName="test.png" />
    ));
    const loadingOverlay = container.querySelector('.image-loading-overlay');
    expect(loadingOverlay).toBeTruthy();
  });

  it('hides loading overlay after image loads', async () => {
    const { container } = render(() => (
      <ImagePreview src="/test-image.png" fileName="test.png" />
    ));
    const img = container.querySelector('img');
    if (img) {
      fireEvent.load(img);
      await waitFor(() => {
        const loadingOverlay = container.querySelector('.image-loading-overlay');
        expect(loadingOverlay).toBeFalsy();
      });
    }
  });

  it('shows error overlay when image fails to load', async () => {
    const { container } = render(() => (
      <ImagePreview src="/invalid-image.png" fileName="invalid.png" />
    ));
    const img = container.querySelector('img');
    if (img) {
      fireEvent.error(img);
      await waitFor(() => {
        const errorOverlay = container.querySelector('.image-error-overlay');
        expect(errorOverlay).toBeTruthy();
        expect(screen.getByText('Failed to load image')).toBeTruthy();
      });
    }
  });

  it('hides image visibility when error occurs', async () => {
    const { container } = render(() => (
      <ImagePreview src="/invalid-image.png" fileName="invalid.png" />
    ));
    const img = container.querySelector('img');
    if (img) {
      fireEvent.error(img);
      await waitFor(() => {
        expect(img?.style.visibility).toBe('hidden');
      });
    }
  });

  it('renders toolbar with file info', () => {
    render(() => (
      <ImagePreview src="/test-image.png" fileName="test.png" fileSize={1024} />
    ));
    expect(screen.getByText('test.png')).toBeTruthy();
    expect(screen.getByText('1.00 KB')).toBeTruthy();
  });

  it('shows zoom controls', () => {
    const { container } = render(() => (
      <ImagePreview src="/test-image.png" fileName="test.png" />
    ));
    const zoomOutBtn = container.querySelector('button[title="Zoom Out"]');
    const zoomInBtn = container.querySelector('button[title="Zoom In"]');
    const fitBtn = container.querySelector('button[title="Fit Window"]');
    expect(zoomOutBtn).toBeTruthy();
    expect(zoomInBtn).toBeTruthy();
    expect(fitBtn).toBeTruthy();
  });

  it('shows download button', () => {
    const { container } = render(() => (
      <ImagePreview src="/test-image.png" fileName="test.png" />
    ));
    const downloadBtn = container.querySelector('button[title="Download"]');
    expect(downloadBtn).toBeTruthy();
  });

  it('shows fullscreen button', () => {
    const { container } = render(() => (
      <ImagePreview src="/test-image.png" fileName="test.png" />
    ));
    const fullscreenBtn = container.querySelector('button[title="Fullscreen"]');
    expect(fullscreenBtn).toBeTruthy();
  });

  it('shows initial scale at 100%', () => {
    render(() => (
      <ImagePreview src="/test-image.png" fileName="test.png" />
    ));
    expect(screen.getByText('100%')).toBeTruthy();
  });
});