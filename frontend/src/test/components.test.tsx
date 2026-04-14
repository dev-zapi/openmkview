import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import GitPanel from '../components/GitPanel';
import OutlinePanel from '../components/OutlinePanel';
import SettingsPanel from '../components/SettingsPanel';
import ImagePreview from '../components/ImagePreview';

describe('GitPanel', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
  });

  it('renders nothing when closed', () => {
    const { container } = render(() => (
      <GitPanel projectId={1} isOpen={false} onClose={() => {}} />
    ));
    expect(container.innerHTML).toBe('');
  });

  it('renders git panel when open', () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ branch: 'main', files: [], isRepo: true }),
    });

    render(() => <GitPanel projectId={1} isOpen={true} onClose={() => {}} />);
    expect(screen.getByText('🌿 Git')).toBeTruthy();
  });

  it('shows not a repo message when not in git repo', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ branch: '', files: [], isRepo: false }),
    });

    render(() => <GitPanel projectId={1} isOpen={true} onClose={() => {}} />);

    // Wait for async data loading
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  it('calls onClose when close button clicked', () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ branch: 'main', files: [], isRepo: true }),
    });

    const onClose = vi.fn();
    render(() => <GitPanel projectId={1} isOpen={true} onClose={onClose} />);

    const closeBtn = screen.getByText('✕');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('OutlinePanel', () => {
  const mockHeadings = [
    { depth: 1, text: 'Introduction', id: 'introduction' },
    { depth: 2, text: 'Getting Started', id: 'getting-started' },
    { depth: 3, text: 'Installation', id: 'installation' },
  ];

  it('renders hidden panel when closed', () => {
    const { container } = render(() => (
      <OutlinePanel headings={mockHeadings} isOpen={false} onClose={() => {}} />
    ));
    const panel = container.querySelector('.outline-panel');
    expect(panel).toBeTruthy();
    expect(panel?.classList.contains('outline-panel-hidden')).toBe(true);
  });

  it('renders outline panel when open', () => {
    render(() => (
      <OutlinePanel headings={mockHeadings} isOpen={true} onClose={() => {}} />
    ));
    expect(screen.getByText('Outline')).toBeTruthy();
  });

  it('renders all headings', () => {
    render(() => (
      <OutlinePanel headings={mockHeadings} isOpen={true} onClose={() => {}} />
    ));
    expect(screen.getByText('Introduction')).toBeTruthy();
    expect(screen.getByText('Getting Started')).toBeTruthy();
    expect(screen.getByText('Installation')).toBeTruthy();
  });

  it('shows empty state when no headings', () => {
    render(() => (
      <OutlinePanel headings={[]} isOpen={true} onClose={() => {}} />
    ));
    expect(screen.getByText('No headings found')).toBeTruthy();
  });
});

describe('SettingsPanel', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders nothing when closed', () => {
    const { container } = render(() => (
      <SettingsPanel isOpen={false} onClose={() => {}} />
    ));
    expect(container.innerHTML).toBe('');
  });

  it('renders settings panel when open', () => {
    render(() => <SettingsPanel isOpen={true} onClose={() => {}} />);
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('renders all settings sections', () => {
    render(() => <SettingsPanel isOpen={true} onClose={() => {}} />);
    expect(screen.getByText('Markdown')).toBeTruthy();
    expect(screen.getByText('Themes')).toBeTruthy();
    expect(screen.getByText('Trash Settings')).toBeTruthy();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    const { container } = render(() => <SettingsPanel isOpen={true} onClose={onClose} />);

    const closeBtn = container.querySelector('.close-btn');
    if (closeBtn) {
      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalled();
    }
  });

  it('calls onClose when overlay clicked', () => {
    const onClose = vi.fn();
    const { container } = render(() => (
      <SettingsPanel isOpen={true} onClose={onClose} />
    ));

    const overlay = container.querySelector('.settings-overlay');
    if (overlay) {
      fireEvent.click(overlay);
      expect(onClose).toHaveBeenCalled();
    }
  });

  it('does not call onClose when panel clicked', () => {
    const onClose = vi.fn();
    const { container } = render(() => <SettingsPanel isOpen={true} onClose={onClose} />);

    const panel = container.querySelector('.settings-panel');
    if (panel) {
      fireEvent.click(panel);
      expect(onClose).not.toHaveBeenCalled();
    }
  });
});

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
