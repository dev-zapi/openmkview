import { describe, expect, it } from 'vitest';
import {
  buildBlockTextIndex,
  clearRangeHighlights,
  highlightTextRange,
  normalizedOffsetForBoundary,
} from '../../utils/rangeHighlight';

function paragraph(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = `<p>${html}</p>`;
  return root.firstElementChild as HTMLElement;
}

describe('rangeHighlight utils', () => {
  it('highlights a range inside one text node with annotation attributes', () => {
    const root = paragraph('The quick brown fox');
    const marks = highlightTextRange(root, 10, 15, { annotationId: 7 });

    expect(marks).toHaveLength(1);
    expect(marks[0].textContent).toBe('brown');
    expect(marks[0].getAttribute('data-annotation-id')).toBe('7');
    expect(marks[0].hasAttribute('data-annotation-highlight')).toBe(true);
    expect(root.textContent).toBe('The quick brown fox');
  });

  it('highlights a range spanning inline formatting nodes', () => {
    const root = paragraph('Hello <strong>brave new</strong> world');
    const marks = highlightTextRange(root, 6, 15, { annotationId: 3 });

    expect(marks.length).toBeGreaterThanOrEqual(1);
    expect(marks.map((mark) => mark.textContent).join('')).toBe('brave new');
    expect(root.textContent).toBe('Hello brave new world');
  });

  it('maps normalized offsets through collapsed whitespace', () => {
    const root = paragraph('alpha \n\t  beta   gamma');
    const index = buildBlockTextIndex(root);

    expect(index.text).toBe('alpha beta gamma');

    const betaStart = index.text.indexOf('beta');
    const marks = highlightTextRange(root, betaStart, betaStart + 4, { annotationId: 1 });

    expect(marks.map((mark) => mark.textContent).join('')).toBe('beta');
    expect(root.textContent).toBe('alpha \n\t  beta   gamma');
  });

  it('maps DOM selection boundaries to normalized offsets', () => {
    const root = paragraph('alpha   beta');
    const index = buildBlockTextIndex(root);
    const textNode = root.firstChild as Text;
    const betaRawOffset = textNode.nodeValue!.indexOf('beta');

    expect(normalizedOffsetForBoundary(index, root, textNode, betaRawOffset)).toBe(6);
  });

  it('supports overlapping annotations on the same text', () => {
    const root = paragraph('alpha beta gamma');
    highlightTextRange(root, 0, 6, { annotationId: 1 });
    const second = highlightTextRange(root, 4, 10, { annotationId: 2 });

    expect(root.querySelectorAll('mark[data-annotation-id="1"]').length).toBeGreaterThan(0);
    expect(second.length).toBeGreaterThan(0);
    expect(second.map((mark) => mark.textContent).join('')).toBe('a beta');
    expect(root.textContent).toBe('alpha beta gamma');
  });

  it('clears only annotation highlights and preserves text', () => {
    const root = paragraph('preview search preview');
    const search = document.createElement('mark');
    search.setAttribute('data-search-highlight', 'true');
    search.textContent = 'search';
    root.innerHTML = 'preview ';
    root.appendChild(search);
    root.appendChild(document.createTextNode(' preview'));

    highlightTextRange(root, 0, 7, { annotationId: 9 });
    clearRangeHighlights(root);

    expect(root.querySelector('mark[data-annotation-highlight]')).toBeNull();
    expect(root.querySelector('mark[data-search-highlight="true"]')).not.toBeNull();
    expect(root.textContent).toBe('preview search preview');
  });
});
