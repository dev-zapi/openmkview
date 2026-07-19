import { describe, it, expect } from 'vitest';
import { useDiagramZoom } from '../../hooks/useDiagramZoom';

describe('useDiagramZoom', () => {
  it('initializes at scale 1 with zero translation', () => {
    const { state } = useDiagramZoom();
    expect(state()).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it('clamps scale to min and max bounds', () => {
    const { state, zoomOut, zoomIn } = useDiagramZoom();

    for (let i = 0; i < 20; i++) zoomOut();
    expect(state().scale).toBeGreaterThanOrEqual(0.25);

    for (let i = 0; i < 40; i++) zoomIn();
    expect(state().scale).toBeLessThanOrEqual(5);
  });

  it('resets to initial state', () => {
    const { state, zoomIn, resetZoom } = useDiagramZoom();
    zoomIn();
    expect(state().scale).toBeGreaterThan(1);
    resetZoom();
    expect(state()).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it('clamps translation within measured bounds when content fits container', () => {
    const { state, updateTranslate, measure } = useDiagramZoom();
    measure({ width: 100, height: 100 }, { width: 400, height: 400 });
    updateTranslate(200, 200);
    // Content fits: translate locked to (0,0) — flexbox handles centering
    expect(state().x).toBe(0);
    expect(state().y).toBe(0);
  });

  it('clamps translation when content is larger than container', () => {
    const { state, updateTranslate, measure } = useDiagramZoom();
    // Content 600×300 in container 400×200
    // Valid range: x in [-100, 100], y in [-50, 50] — centered around 0
    measure({ width: 600, height: 300 }, { width: 400, height: 200 });
    updateTranslate(-1000, -500);
    expect(state().x).toBe(-100);
    expect(state().y).toBe(-50);
    updateTranslate(1000, 500);
    expect(state().x).toBe(100);
    expect(state().y).toBe(50);
  });

  it('re-clamps translation after container is measured', () => {
    const { state, updateTranslate, measure } = useDiagramZoom();
    updateTranslate(100, 100);
    // Sizes are 0, all translates clamp to (0, 0)
    expect(state()).toEqual({ scale: 1, x: 0, y: 0 });
    // Content fits container: translate locked to (0, 0)
    measure({ width: 100, height: 100 }, { width: 200, height: 200 });
    expect(state().x).toBe(0);
    expect(state().y).toBe(0);
  });
});
