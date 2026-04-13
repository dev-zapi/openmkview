import { Component, createSignal, Show, onMount } from 'solid-js';

interface ImagePreviewProps {
  src: string;
  fileName: string;
  fileSize?: number;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

const ImagePreview: Component<ImagePreviewProps> = (props) => {
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal(false);
  const [scale, setScale] = createSignal(100);
  const [imageWidth, setImageWidth] = createSignal(0);
  const [imageHeight, setImageHeight] = createSignal(0);
  const [isFullscreen, setIsFullscreen] = createSignal(false);

  const handleLoad = (e: Event) => {
    const img = e.target as HTMLImageElement;
    setImageWidth(img.naturalWidth);
    setImageHeight(img.naturalHeight);
    setLoading(false);
  };

  const handleError = () => {
    setLoading(false);
    setError(true);
  };

  const handleZoomIn = () => {
    setScale(Math.min(scale() + 25, 300));
  };

  const handleZoomOut = () => {
    setScale(Math.max(scale() - 25, 25));
  };

  const handleFitWindow = () => {
    setScale(100);
  };

  const handleFullscreen = () => {
    setIsFullscreen(true);
  };

  const handleExitFullscreen = () => {
    setIsFullscreen(false);
    setScale(100);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = props.src;
    link.download = props.fileName;
    link.click();
  };

  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFullscreen() && e.key === 'Escape') {
        handleExitFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <Show
      when={!isFullscreen()}
      fallback={
        <div class="image-fullscreen-overlay" onClick={handleExitFullscreen}>
          <div class="image-fullscreen-content">
            <img
              src={props.src}
              alt={props.fileName}
              style={{ transform: `scale(${scale() / 100})` }}
              onClick={(e) => e.stopPropagation()}
            />
            <div class="image-fullscreen-controls">
              <button onClick={handleZoomOut} title="Zoom Out">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="8" y1="11" x2="14" y2="11"/>
                </svg>
              </button>
              <span>{scale()}%</span>
              <button onClick={handleZoomIn} title="Zoom In">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="11" y1="8" x2="11" y2="14"/>
                  <line x1="8" y1="11" x2="14" y2="11"/>
                </svg>
              </button>
              <button onClick={handleExitFullscreen} title="Exit Fullscreen">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      }
    >
      <div class="image-preview">
        <div class="image-toolbar">
          <div class="image-info">
            <span class="image-name">{props.fileName}</span>
            <Show when={props.fileSize}>
              <span class="image-size">{formatFileSize(props.fileSize!)}</span>
            </Show>
            <Show when={!loading() && !error() && imageWidth() > 0}>
              <span class="image-dimensions">{imageWidth()} x {imageHeight()}</span>
            </Show>
          </div>
          <div class="image-controls">
            <button onClick={handleZoomOut} title="Zoom Out">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="8" y1="11" x2="14" y2="11"/>
              </svg>
            </button>
            <span class="scale-value">{scale()}%</span>
            <button onClick={handleZoomIn} title="Zoom In">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="11" y1="8" x2="11" y2="14"/>
                <line x1="8" y1="11" x2="14" y2="11"/>
              </svg>
            </button>
            <button onClick={handleFitWindow} title="Fit Window">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
              </svg>
            </button>
            <button onClick={handleFullscreen} title="Fullscreen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                <line x1="21" y1="21" x2="3" y2="3"/>
              </svg>
            </button>
            <button onClick={handleDownload} title="Download">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="image-content">
          <Show when={loading()}>
            <div class="image-loading">
              <div class="spinner"></div>
            </div>
          </Show>
          <Show when={error()}>
            <div class="image-error">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              <p>Failed to load image</p>
            </div>
          </Show>
          <Show when={!loading() && !error()}>
            <img
              src={props.src}
              alt={props.fileName}
              onLoad={handleLoad}
              onError={handleError}
              style={{ transform: `scale(${scale() / 100})` }}
            />
          </Show>
        </div>
      </div>
    </Show>
  );
};

export default ImagePreview;