import { createSignal } from 'solid-js';

export interface Size {
  width: number;
  height: number;
}

export interface ZoomState {
  scale: number;
  x: number;
  y: number;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 5;
const WHEEL_SENSITIVITY = 0.001;
const BUTTON_ZOOM_FACTOR = 1.2;

export function useDiagramZoom() {
  const [state, setState] = createSignal<ZoomState>({ scale: 1, x: 0, y: 0 });
  const [naturalSize, setNaturalSize] = createSignal<Size>({ width: 0, height: 0 });
  const [containerSize, setContainerSize] = createSignal<Size>({ width: 0, height: 0 });

  const clampScale = (scale: number): number => {
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
  };

  const clampTranslate = (x: number, y: number, scale: number): { x: number; y: number } => {
    const nw = naturalSize().width * scale;
    const nh = naturalSize().height * scale;
    const cw = containerSize().width;
    const ch = containerSize().height;

    let minX: number;
    let maxX: number;
    if (nw <= cw) {
      minX = (cw - nw) / 2;
      maxX = minX;
    } else {
      minX = cw - nw;
      maxX = 0;
    }

    let minY: number;
    let maxY: number;
    if (nh <= ch) {
      minY = (ch - nh) / 2;
      maxY = minY;
    } else {
      minY = ch - nh;
      maxY = 0;
    }

    return {
      x: Math.min(maxX, Math.max(minX, x)),
      y: Math.min(maxY, Math.max(minY, y)),
    };
  };

  const updateScale = (newScale: number) => {
    const clamped = clampScale(newScale);
    setState((prev) => {
      const clampedTranslate = clampTranslate(prev.x, prev.y, clamped);
      return { scale: clamped, ...clampedTranslate };
    });
  };

  const updateTranslate = (x: number, y: number) => {
    setState((prev) => {
      const clamped = clampTranslate(x, y, prev.scale);
      return { scale: prev.scale, ...clamped };
    });
  };

  const zoomIn = () => updateScale(state().scale * BUTTON_ZOOM_FACTOR);
  const zoomOut = () => updateScale(state().scale / BUTTON_ZOOM_FACTOR);
  const resetZoom = () => {
    setState({ scale: 1, ...clampTranslate(0, 0, 1) });
  };

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    const delta = -event.deltaY * WHEEL_SENSITIVITY;
    const factor = Math.exp(delta);
    updateScale(state().scale * factor);
  };

  const measure = (content: Size, container: Size) => {
    setNaturalSize(content);
    setContainerSize(container);
    setState((prev) => ({
      scale: prev.scale,
      ...clampTranslate(prev.x, prev.y, prev.scale),
    }));
  };

  return {
    state,
    zoomIn,
    zoomOut,
    resetZoom,
    onWheel,
    updateScale,
    updateTranslate,
    measure,
  };
}
