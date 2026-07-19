import { Component, Show, createSignal, createEffect, onCleanup, onMount } from 'solid-js';
import { Portal } from 'solid-js/web';
import { renderZoomDiagram, type ZoomDiagramSource } from '../services/diagramZoomService';
import { useDiagramZoom } from '../hooks/useDiagramZoom';
import './DiagramZoomModal.css';

interface DiagramZoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  source: ZoomDiagramSource | null;
  title?: string;
}

const distance = (a: { x: number; y: number }, b: { x: number; y: number }): number => {
  return Math.hypot(a.x - b.x, a.y - b.y);
};

const DiagramZoomModal: Component<DiagramZoomModalProps> = (props) => {
  const { state, zoomIn, zoomOut, resetZoom, onWheel, updateScale, updateTranslate, measure } =
    useDiagramZoom();
  const [svg, setSvg] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');

  let overlayRef: HTMLDivElement | undefined;
  let contentRef: HTMLDivElement | undefined;
  let transformRef: HTMLDivElement | undefined;
  let pointers = new Map<number, { x: number; y: number }>();
  let dragStart: { x: number; y: number; tx: number; ty: number } | null = null;
  let pinchStartDistance = 0;
  let pinchStartScale = 1;

  createEffect(() => {
    if (props.isOpen) {
      const source = props.source;
      document.body.style.overflow = 'hidden';
      if (!source) return;

      setLoading(true);
      setError('');
      renderZoomDiagram(source).then((html) => {
        setSvg(html);
      }).catch((err) => {
        setError(err instanceof Error ? err.message : '图表加载失败');
      }).finally(() => {
        setLoading(false);
      });
    } else {
      setSvg('');
      setError('');
      resetZoom();
      document.body.style.overflow = '';
    }
  });

  onCleanup(() => {
    document.body.style.overflow = '';
  });

  onMount(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && props.isOpen) {
        props.onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    onCleanup(() => document.removeEventListener('keydown', handleKey));
  });

  createEffect(() => {
    // Re-measure whenever the SVG content or scale changes
    svg();
    state().scale;
    window.setTimeout(() => {
      if (transformRef && contentRef) {
        const contentRect = transformRef.getBoundingClientRect();
        const containerRect = contentRef.getBoundingClientRect();
        measure(
          { width: contentRect.width / state().scale, height: contentRect.height / state().scale },
          { width: containerRect.width, height: containerRect.height }
        );
      }
    }, 0);
  });

  const handleOverlayClick = (e: MouseEvent) => {
    if (e.target === overlayRef) {
      props.onClose();
    }
  };

  const handlePointerDown = (e: PointerEvent) => {
    if (!contentRef) return;
    contentRef.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 1) {
      dragStart = { x: e.clientX, y: e.clientY, tx: state().x, ty: state().y };
    } else if (pointers.size === 2) {
      const pts = Array.from(pointers.values());
      pinchStartDistance = distance(pts[0], pts[1]);
      pinchStartScale = state().scale;
      dragStart = null;
    }
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 1 && dragStart) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      updateTranslate(dragStart.tx + dx, dragStart.ty + dy);
    } else if (pointers.size === 2) {
      const pts = Array.from(pointers.values());
      const dist = distance(pts[0], pts[1]);
      if (pinchStartDistance > 0) {
        updateScale(pinchStartScale * (dist / pinchStartDistance));
      }
    }
  };

  const handlePointerUp = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) {
      dragStart = null;
      pinchStartDistance = 0;
    }
  };

  return (
    <Show when={props.isOpen}>
      <Portal>
        <div
          ref={overlayRef}
          class="diagram-zoom-overlay"
          onClick={handleOverlayClick}
          role="dialog"
          aria-modal="true"
          aria-label="图表放大预览"
        >
          <div class="diagram-zoom-dialog" onClick={(e) => e.stopPropagation()}>
            <div class="diagram-zoom-header">
              <span class="diagram-zoom-title">{props.title || '图表预览'}</span>
              <button
                class="diagram-zoom-close"
                onClick={props.onClose}
                aria-label="关闭"
                type="button"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div
              ref={contentRef}
              class="diagram-zoom-content"
              onWheel={onWheel}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <Show when={loading()}>
                <div class="diagram-zoom-loading">
                  <div class="diagram-zoom-spinner" />
                  正在加载高清图表…
                </div>
              </Show>
              <Show when={!loading() && error()}>
                <div class="diagram-zoom-error">{error()}</div>
              </Show>
              <Show when={!loading() && svg()}>
                <div
                  ref={transformRef}
                  class="diagram-zoom-transform"
                  style={{
                    transform: `translate(${state().x}px, ${state().y}px) scale(${state().scale})`,
                  }}
                  innerHTML={svg()}
                />
              </Show>
            </div>

            <div class="diagram-zoom-controls">
              <button type="button" class="diagram-zoom-btn" onClick={zoomOut} aria-label="缩小">−</button>
              <span class="diagram-zoom-scale">{Math.round(state().scale * 100)}%</span>
              <button type="button" class="diagram-zoom-btn" onClick={zoomIn} aria-label="放大">+</button>
              <button type="button" class="diagram-zoom-btn diagram-zoom-reset" onClick={resetZoom}>
                重置
              </button>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  );
};

export default DiagramZoomModal;
