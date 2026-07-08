import { describe, it, expect } from 'vitest';
import { normalizeSvgForZoom } from '../../services/diagramZoomService';

describe('normalizeSvgForZoom', () => {
  it('should replace width and height with viewBox-derived dimensions', () => {
    const svg = '<svg width="100" height="200"><rect/></svg>';
    const result = normalizeSvgForZoom(svg);
    expect(result).toContain('<svg');
    expect(result).toContain('viewBox="0 0 100 200"');
    expect(result).toContain('width="100"');
    expect(result).toContain('height="200"');
  });

  it('should keep existing viewBox and set explicit dimensions from it', () => {
    const svg = '<svg width="100" height="200" viewBox="0 0 100 200"><rect/></svg>';
    const result = normalizeSvgForZoom(svg);
    expect(result).toContain('viewBox="0 0 100 200"');
    expect(result).toContain('width="100"');
    expect(result).toContain('height="200"');
  });

  it('should create viewBox from width and height when missing', () => {
    const svg = '<svg width="300px" height="150px"><rect/></svg>';
    const result = normalizeSvgForZoom(svg);
    expect(result).toContain('viewBox="0 0 300 150"');
    expect(result).toContain('width="300"');
    expect(result).toContain('height="150"');
  });

  it('should fallback to default viewBox and dimensions when dimensions are missing or invalid', () => {
    const svg = '<svg><rect/></svg>';
    const result = normalizeSvgForZoom(svg);
    expect(result).toContain('viewBox="0 0 800 600"');
    expect(result).toContain('width="800"');
    expect(result).toContain('height="600"');
  });

  it('should add zoom class and preserveAspectRatio', () => {
    const svg = '<svg viewBox="0 0 100 100"><rect/></svg>';
    const result = normalizeSvgForZoom(svg);
    expect(result).toContain('class="diagram-zoom-svg"');
    expect(result).toContain('preserveAspectRatio="xMidYMid meet"');
  });

  it('should return original input when no svg element exists', () => {
    const html = '<div>no svg</div>';
    expect(normalizeSvgForZoom(html)).toBe(html);
  });
});
