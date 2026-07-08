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
    expect(state().x).toBe(150);
    expect(state().y).toBe(150);
  });

  it('clamps translation when content is larger than container', () => {
    const { state, updateTranslate, measure } = useDiagramZoom();
    measure({ width: 600, height: 300 }, { width: 400, height: 200 });
    updateTranslate(-1000, -500);
    expect(state().x).toBe(-200);
    expect(state().y).toBe(-100);
  });

  it('re-clamps translation after container is measured', () => {
    const { state, updateTranslate, measure } = useDiagramZoom();
    updateTranslate(100, 100);
    expect(state()).toEqual({ scale: 1, x: 0, y: 0 });
    measure({ width: 100, height: 100 }, { width: 200, height: 200 });
    expect(state().x).toBe(50);
    expect(state().y).toBe(50);
  });
});
