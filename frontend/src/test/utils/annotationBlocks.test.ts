import { describe, expect, it } from 'vitest';
import {
  assignBlockAnchors,
  ensureBlockMarkers,
  blockAnchorFrom,
  applyAnnotationHighlights,
} from '../../utils/annotationBlocks';
import { encodeDiagramCode } from '../../utils/markdown';
import type { Annotation } from '../../types';

function createRoot(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

describe('annotationBlocks', () => {
  it('assigns deterministic block ids to identical content', () => {
    const html = '<h1>Title</h1><p>Hello world</p>';
    const first = assignBlockAnchors(createRoot(html));
    const second = assignBlockAnchors(createRoot(html));

    expect(first.map((block) => block.blockId)).toEqual(
      second.map((block) => block.blockId)
    );
    expect(first[1].text).toBe('Hello world');
  });

  it('distinguishes identical blocks by occurrence', () => {
    const blocks = assignBlockAnchors(createRoot('<p>Same</p><p>Same</p>'));

    expect(blocks).toHaveLength(2);
    expect(blocks[0].blockId).not.toBe(blocks[1].blockId);
  });

  it('records the heading path in effect for each block', () => {
    const blocks = assignBlockAnchors(
      createRoot(
        '<h1>Intro</h1><p>alpha</p><h2>Details</h2><p>beta</p><h2>Other</h2><p>gamma</p>'
      )
    );

    expect(blocks.find((block) => block.text === 'alpha')?.headingPath).toEqual(['Intro']);
    expect(blocks.find((block) => block.text === 'beta')?.headingPath).toEqual([
      'Intro',
      'Details',
    ]);
    expect(blocks.find((block) => block.text === 'gamma')?.headingPath).toEqual([
      'Intro',
      'Other',
    ]);
  });

  it('anchors code blocks to their source, not header chrome', () => {
    const root = createRoot(
      '<pre data-lang="rust"><code>const value = 1;</code></pre>'
    );
    const pre = root.firstElementChild as HTMLElement;
    const header = document.createElement('div');
    header.className = 'code-block-header';
    header.textContent = 'rustCopy';
    pre.appendChild(header);

    const [block] = assignBlockAnchors(root);

    expect(block.blockType).toBe('code');
    expect(block.text).toBe('const value = 1;');
  });

  it('anchors diagram wrappers to the diagram source', () => {
    const source = 'graph TD; A-->B;';
    const root = createRoot(
      `<div class="code-block-wrapper" data-diagram-code="${encodeDiagramCode(source)}">` +
        '<div class="code-block-header">mermaidCopy</div>' +
        `<pre><code>${source}</code></pre></div>`
    );

    const [block] = assignBlockAnchors(root);

    expect(block.blockType).toBe('code');
    expect(block.text).toBe(source);
  });

  it('anchors table wrappers to the table content', () => {
    const blocks = assignBlockAnchors(
      createRoot(
        '<div class="table-wrapper"><table><thead><tr><th>Name</th></tr></thead></table></div>'
      )
    );

    expect(blocks[0].blockType).toBe('table');
    expect(blocks[0].text).toBe('Name');
  });

  it('builds a versioned whole-block anchor payload', () => {
    const [block] = assignBlockAnchors(
      createRoot('<h1>Intro</h1><p>alpha</p>')
    ).filter((candidate) => candidate.text === 'alpha');

    const anchor = blockAnchorFrom(block);

    expect(anchor.version).toBe(1);
    expect(anchor.segments).toEqual([
      {
        kind: 'block',
        blockHash: block.blockId,
        blockText: 'alpha',
        blockType: 'p',
        headingPath: ['Intro'],
      },
    ]);
  });

  it('adds markers with a content-based accessible label', () => {
    const blocks = assignBlockAnchors(createRoot('<p>alpha</p>'));
    ensureBlockMarkers(blocks);

    const marker = blocks[0].element.querySelector('button');
    expect(marker?.getAttribute('aria-label')).toBe('Annotate this block: alpha');
  });

  it('attaches annotations by block hash and clears stale attachments', () => {
    const root = createRoot('<p>alpha</p><p>beta</p>');
    const blocks = assignBlockAnchors(root);
    const annotation: Annotation = {
      id: 7,
      projectId: 1,
      relativePath: 'doc.md',
      anchor: blockAnchorFrom(blocks[0]),
      snapshot: null,
      resolved: false,
      createdAt: '2026-01-01 00:00:00',
      updatedAt: '2026-01-01 00:00:00',
      notes: [],
    };

    applyAnnotationHighlights(root, [annotation]);

    expect(blocks[0].element.classList.contains('annotation-highlighted')).toBe(true);
    expect(blocks[0].element.getAttribute('data-annotation-id')).toBe('7');
    expect(blocks[1].element.classList.contains('annotation-highlighted')).toBe(false);

    applyAnnotationHighlights(root, []);

    expect(blocks[0].element.classList.contains('annotation-highlighted')).toBe(false);
    expect(blocks[0].element.hasAttribute('data-annotation-id')).toBe(false);
  });
});
