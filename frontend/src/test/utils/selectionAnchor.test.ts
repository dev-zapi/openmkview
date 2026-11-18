import { describe, expect, it } from 'vitest';
import { afterEach } from 'vitest';
import { anchorFromSelection } from '../../utils/selectionAnchor';
import { assignBlockAnchors } from '../../utils/annotationBlocks';

afterEach(() => {
  document.body.innerHTML = '';
  document.getSelection()?.removeAllRanges();
});

function attach(root: HTMLElement): HTMLElement {
  // jsdom only keeps non-collapsed selections for nodes inside the document.
  document.body.appendChild(root);
  return root;
}

function selectionFor(
  startNode: Node,
  startOffset: number,
  endNode: Node,
  endOffset: number
): Selection {
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  const selection = document.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  return selection;
}

function firstText(element: Element, index = 0): Text {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  for (let position = 0; position < index && node; position += 1) {
    node = walker.nextNode();
  }
  return node as Text;
}

describe('selectionAnchor utils', () => {
  it('captures a selection inside one block with context excerpts', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>Alpha beta gamma delta.</p>';
    attach(root);
    const blocks = assignBlockAnchors(root);
    const text = firstText(blocks[0].element);
    const start = text.nodeValue!.indexOf('gamma');
    const selection = selectionFor(text, start, text, start + 'gamma'.length);

    const anchor = anchorFromSelection(root, selection, blocks);

    expect(anchor?.version).toBe(1);
    expect(anchor?.segments).toHaveLength(1);
    expect(anchor?.segments[0]).toMatchObject({
      kind: 'text',
      blockHash: blocks[0].model.id,
      quote: 'gamma',
      prefix: 'Alpha beta ',
      suffix: ' delta.',
    });
  });

  it('captures a cross-block selection as one segment per block', () => {
    const root = document.createElement('div');
    root.innerHTML =
      '<p>The argument starts here.</p><p>It continues right here.</p>';
    attach(root);
    const blocks = assignBlockAnchors(root);
    const first = firstText(blocks[0].element);
    const second = firstText(blocks[1].element);
    const selection = selectionFor(
      first,
      first.nodeValue!.indexOf('starts'),
      second,
      second.nodeValue!.indexOf('here') + 'here'.length
    );

    const anchor = anchorFromSelection(root, selection, blocks);

    expect(anchor?.segments.map((segment) => segment.quote)).toEqual([
      'starts here.',
      'It continues right here',
    ]);
  });

  it('returns null for a collapsed selection or an endpoint outside a block', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>Alpha beta.</p><div>outside</div>';
    attach(root);
    const blocks = assignBlockAnchors(root);
    const text = firstText(blocks[0].element);

    expect(anchorFromSelection(root, selectionFor(text, 2, text, 2), blocks)).toBeNull();
    expect(
      anchorFromSelection(root, selectionFor(root, 0, root, root.childNodes.length), blocks)
    ).toBeNull();
  });
});
