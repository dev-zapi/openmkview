import { type DiagramType, renderDiagram } from './diagramService';

export interface ZoomDiagramSource {
  type: DiagramType;
  code: string;
  theme: 'light' | 'dark';
}

export async function renderZoomDiagram(source: ZoomDiagramSource): Promise<string> {
  const svg = await renderDiagram(source.type, source.code, source.theme);
  return normalizeSvgForZoom(svg);
}

export function normalizeSvgForZoom(svg: string): string {
  if (typeof document === 'undefined') {
    return normalizeSvgWithRegex(svg);
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(svg, 'image/svg+xml');
  const svgEl = doc.querySelector('svg');
  if (!svgEl) {
    return svg;
  }

  let width = svgEl.getAttribute('width');
  let height = svgEl.getAttribute('height');

  if (!svgEl.getAttribute('viewBox')) {
    const parsedWidth = parseSvgLength(width);
    const parsedHeight = parseSvgLength(height);
    if (parsedWidth && parsedHeight) {
      svgEl.setAttribute('viewBox', `0 0 ${parsedWidth} ${parsedHeight}`);
    } else {
      svgEl.setAttribute('viewBox', '0 0 800 600');
    }
  }

  const viewBox = svgEl.getAttribute('viewBox') || '';
  const { width: vbWidth, height: vbHeight } = parseViewBox(viewBox);

  svgEl.removeAttribute('width');
  svgEl.removeAttribute('height');

  // Give the SVG an explicit natural size so it is visible and can be
  // constrained by max-width/max-height in the zoom modal.
  if (vbWidth && vbHeight) {
    svgEl.setAttribute('width', String(vbWidth));
    svgEl.setAttribute('height', String(vbHeight));
  }

  svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svgEl.classList.add('diagram-zoom-svg');

  const serializer = new XMLSerializer();
  return serializer.serializeToString(svgEl);
}

function normalizeSvgWithRegex(svg: string): string {
  let width = '';
  let height = '';
  const widthMatch = svg.match(/<svg[^>]*\swidth=["']([^"']+)["']/i);
  const heightMatch = svg.match(/<svg[^>]*\sheight=["']([^"']+)["']/i);
  if (widthMatch) width = widthMatch[1];
  if (heightMatch) height = heightMatch[1];

  const viewBoxMatch = svg.match(/viewBox=["']([^"']+)["']/i);
  let viewBox = viewBoxMatch ? viewBoxMatch[1] : '';

  let result = svg
    .replace(/(<svg[^>]*?)\swidth=["'][^"']*["']/gi, '$1')
    .replace(/(<svg[^>]*?)\sheight=["'][^"']*["']/gi, '$1')
    .replace(/<svg/, '<svg preserveAspectRatio="xMidYMid meet" class="diagram-zoom-svg"');

  if (!viewBox) {
    const parsedWidth = parseSvgLength(width);
    const parsedHeight = parseSvgLength(height);
    viewBox = parsedWidth && parsedHeight ? `0 0 ${parsedWidth} ${parsedHeight}` : '0 0 800 600';
    result = result.replace(/<svg/, `<svg viewBox="${viewBox}"`);
  }

  const { width: vbWidth, height: vbHeight } = parseViewBox(viewBox);
  if (vbWidth && vbHeight) {
    result = result.replace(/<svg/, `<svg width="${vbWidth}" height="${vbHeight}"`);
  }

  return result;
}

function parseSvgLength(value: string | null): number | null {
  if (!value) return null;
  const match = value.trim().match(/^([0-9]*\.?[0-9]+)(px|pt|em|rem|%)?$/);
  if (!match) return null;
  const num = parseFloat(match[1]);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function parseViewBox(viewBox: string): { width: number | null; height: number | null } {
  const parts = viewBox.trim().split(/\s+/).map(Number);
  if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
    const [, , w, h] = parts;
    return { width: w > 0 ? w : null, height: h > 0 ? h : null };
  }
  return { width: null, height: null };
}
