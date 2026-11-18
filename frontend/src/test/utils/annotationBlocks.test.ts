import { describe, expect, it } from 'vitest';
import {
  assignBlockAnchors,
  ensureBlockMarkers,
  blockAnchorFrom,
  applyAnnotationHighlights,
  applySearchAndAnnotationHighlights,
  resolveOutdated,
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

    expect(first.map((block) => block.model.id)).toEqual(
      second.map((block) => block.model.id)
    );
    expect(first[1].model.text).toBe('Hello world');
  });

  it('distinguishes identical blocks by occurrence', () => {
    const blocks = assignBlockAnchors(createRoot('<p>Same</p><p>Same</p>'));

    expect(blocks).toHaveLength(2);
    expect(blocks[0].model.id).not.toBe(blocks[1].model.id);
  });

  it('records the heading path in effect for each block', () => {
    const blocks = assignBlockAnchors(
      createRoot(
        '<h1>Intro</h1><p>alpha</p><h2>Details</h2><p>beta</p><h2>Other</h2><p>gamma</p>'
      )
    );

    expect(blocks.find((block) => block.model.text === 'alpha')?.model.headingPath).toEqual(['Intro']);
    expect(blocks.find((block) => block.model.text === 'beta')?.model.headingPath).toEqual([
      'Intro',
      'Details',
    ]);
    expect(blocks.find((block) => block.model.text === 'gamma')?.model.headingPath).toEqual([
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

    expect(block.model.type).toBe('code');
    expect(block.model.text).toBe('const value = 1;');
  });

  it('anchors diagram wrappers to the diagram source', () => {
    const source = 'graph TD; A-->B;';
    const root = createRoot(
      `<div class="code-block-wrapper" data-diagram-code="${encodeDiagramCode(source)}">` +
        '<div class="code-block-header">mermaidCopy</div>' +
        `<pre><code>${source}</code></pre></div>`
    );

    const [block] = assignBlockAnchors(root);

    expect(block.model.type).toBe('code');
    expect(block.model.text).toBe(source);
  });

  it('anchors table wrappers to the table content', () => {
    const blocks = assignBlockAnchors(
      createRoot(
        '<div class="table-wrapper"><table><thead><tr><th>Name</th></tr></thead></table></div>'
      )
    );

    expect(blocks[0].model.type).toBe('table');
    expect(blocks[0].model.text).toBe('Name');
  });

  it('builds a versioned whole-block anchor payload', () => {
    const [block] = assignBlockAnchors(
      createRoot('<h1>Intro</h1><p>alpha</p>')
    ).filter((candidate) => candidate.model.text === 'alpha');

    const anchor = blockAnchorFrom(block);

    expect(anchor.version).toBe(1);
    expect(anchor.segments).toEqual([
      {
        kind: 'block',
        blockHash: block.model.id,
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

  it('attaches multiple annotations to the same block', () => {
    const root = createRoot('<p>alpha</p><p>beta</p>');
    const blocks = assignBlockAnchors(root);
    const first = annotationFor(7, blockAnchorFrom(blocks[0]));
    const second = annotationFor(8, blockAnchorFrom(blocks[0]));

    const attached = applyAnnotationHighlights(root, [first, second], blocks);

    expect(blocks[0].element.classList.contains('annotation-highlighted')).toBe(true);
    expect(blocks[0].element.getAttribute('data-annotation-ids')).toBe('7,8');
    expect(attached.attachments.get(blocks[0].model.id)?.map((annotation) => annotation.id)).toEqual([
      7, 8,
    ]);
    expect(blocks[1].element.classList.contains('annotation-highlighted')).toBe(false);
  });

  it('highlights text segments and resolves them through the Anchor resolver', () => {
    const root = createRoot('<p>The quick brown fox.</p>');
    const blocks = assignBlockAnchors(root);
    ensureBlockMarkers(blocks);
    const annotation: Annotation = {
      id: 9,
      projectId: 1,
      relativePath: 'doc.md',
      anchor: {
        version: 1,
        segments: [
          {
            kind: 'text',
            blockHash: blocks[0].model.id,
            blockText: blocks[0].model.text,
            blockType: 'p',
            headingPath: [],
            quote: 'quick brown',
            prefix: 'The ',
            suffix: ' fox.',
          },
        ],
      },
      snapshot: null,
      resolved: false,
      createdAt: '2026-01-01 00:00:00',
      updatedAt: '2026-01-01 00:00:00',
      notes: [],
    };

    const attached = applyAnnotationHighlights(root, [annotation], blocks);

    const marks = root.querySelectorAll('mark[data-annotation-id="9"]');
    expect(marks).toHaveLength(1);
    expect(marks[0].textContent).toBe('quick brown');
    expect(blocks[0].element.querySelector('.annotation-marker')?.classList.contains('has-annotation')).toBe(true);
    expect(attached.attachments.get(blocks[0].model.id)?.[0]?.id).toBe(9);
  });

  it('reports Outdated annotations with their snapshot and no highlight', () => {
    const root = createRoot('<p>current text</p>');
    const blocks = assignBlockAnchors(root);
    const annotation: Annotation = {
      id: 10,
      projectId: 1,
      relativePath: 'doc.md',
      anchor: {
        version: 1,
        segments: [
          {
            kind: 'text',
            blockHash: 'gone',
            blockText: 'current text',
            blockType: 'p',
            headingPath: [],
            quote: 'vanished words',
            prefix: '',
            suffix: '',
          },
        ],
      },
      snapshot: null,
      resolved: false,
      createdAt: '2026-01-01 00:00:00',
      updatedAt: '2026-01-01 00:00:00',
      notes: [],
    };

    const applied = applyAnnotationHighlights(root, [annotation], blocks);

    expect(root.querySelector('mark[data-annotation-id="10"]')).toBeNull();
    expect(blocks[0].element.classList.contains('annotation-highlighted')).toBe(false);
    expect(applied.attachments.size).toBe(0);
    // The resolver's snapshot drives the Outdated popover; the annotation is
    // never silently attached to unrelated content.
    expect(applied.outdated.get(10)).toBe('vanished words');
  });

  it('does not report resolved annotations as Outdated', () => {
    const root = createRoot('<p>Still here</p>');
    const blocks = assignBlockAnchors(root);
    const annotation = annotationFor(12, blockAnchorFrom(blocks[0]));

    const applied = applyAnnotationHighlights(root, [annotation], blocks);

    expect(applied.outdated.size).toBe(0);
    expect(applied.attachments.get(blocks[0].model.id)?.[0]?.id).toBe(12);
  });

  it('finds search matches inside text that is also annotated', () => {
    const root = createRoot('<p>alpha beta gamma</p>');
    const blocks = assignBlockAnchors(root);
    ensureBlockMarkers(blocks);
    const annotation: Annotation = {
      id: 11,
      projectId: 1,
      relativePath: 'doc.md',
      anchor: {
        version: 1,
        segments: [
          {
            kind: 'text',
            blockHash: blocks[0].model.id,
            blockText: blocks[0].model.text,
            blockType: 'p',
            headingPath: [],
            quote: 'beta',
            prefix: 'alpha ',
            suffix: ' gamma',
          },
        ],
      },
      snapshot: null,
      resolved: false,
      createdAt: '2026-01-01 00:00:00',
      updatedAt: '2026-01-01 00:00:00',
      notes: [],
    };

    const applied = applySearchAndAnnotationHighlights(
      root,
      'beta',
      [annotation],
      blocks
    );

    expect(applied.searchMatches).toHaveLength(1);
    expect(applied.searchMatches[0].textContent).toBe('beta');
    expect(root.querySelector('mark[data-annotation-id="11"]')?.textContent).toBe('beta');
    expect(root.textContent).toBe('alpha beta gamma');
  });

  it('reports Outdated status even when no highlights are drawn', () => {
    const root = createRoot('<p>current text</p>');
    const blocks = assignBlockAnchors(root);
    const gone = annotationFor(13, {
      version: 1,
      segments: [
        {
          kind: 'text',
          blockHash: 'gone',
          blockText: 'current text',
          blockType: 'p',
          headingPath: [],
          quote: 'vanished words',
          prefix: '',
          suffix: '',
        },
      ],
    });
    const active = annotationFor(14, blockAnchorFrom(blocks[0]));

    // Hidden reading mode passes no annotations to the decoration pass, but
    // status must still be computed over every annotation.
    const outdated = resolveOutdated(
      blocks.map((block) => block.model),
      [gone, active]
    );

    expect(outdated.get(13)).toBe('vanished words');
    expect(outdated.has(14)).toBe(false);
  });

  it('attaches annotations by block hash and clears stale attachments', () => {
    const root = createRoot('<p>alpha</p><p>beta</p>');
    const blocks = assignBlockAnchors(root);
    const annotation = annotationFor(7, blockAnchorFrom(blocks[0]));

    applyAnnotationHighlights(root, [annotation], blocks);

    expect(blocks[0].element.classList.contains('annotation-highlighted')).toBe(true);
    expect(blocks[0].element.getAttribute('data-annotation-id')).toBe('7');
    expect(blocks[1].element.classList.contains('annotation-highlighted')).toBe(false);

    applyAnnotationHighlights(root, [], blocks);

    expect(blocks[0].element.classList.contains('annotation-highlighted')).toBe(false);
    expect(blocks[0].element.hasAttribute('data-annotation-id')).toBe(false);
  });

  it('dims a mixed block only when every attached annotation is Resolved', () => {
    const root = createRoot('<p>alpha beta</p>');
    const blocks = assignBlockAnchors(root);
    ensureBlockMarkers(blocks);
    const blockModel = blocks[0].model;

    const blockAnnotation: Annotation = {
      ...annotationFor(20, blockAnchorFrom(blocks[0])),
      resolved: true,
    };
    const textAnnotation: Annotation = {
      ...annotationFor(21, {
        version: 1,
        segments: [
          {
            kind: 'text',
            blockHash: blockModel.id,
            blockText: blockModel.text,
            blockType: 'p',
            headingPath: [],
            quote: 'beta',
            prefix: 'alpha ',
            suffix: '',
          },
        ],
      }),
      resolved: false,
    };

    applyAnnotationHighlights(root, [blockAnnotation, textAnnotation], blocks);

    // Mixed threads: the block stays live so the Active thread is not dimmed.
    expect(blocks[0].element.classList.contains('annotation-highlighted')).toBe(true);
    expect(blocks[0].element.classList.contains('annotation-resolved')).toBe(false);
    expect(
      blocks[0].element.querySelector('.annotation-marker')?.classList.contains('resolved')
    ).toBe(false);

    // Resolving the remaining thread dims the block and its marker.
    applyAnnotationHighlights(
      root,
      [blockAnnotation, { ...textAnnotation, resolved: true }],
      blocks
    );

    expect(blocks[0].element.classList.contains('annotation-resolved')).toBe(true);
    expect(
      blocks[0].element.querySelector('.annotation-marker')?.classList.contains('resolved')
    ).toBe(true);
  });
});

function annotationFor(id: number, anchor: Annotation['anchor']): Annotation {
  return {
    id,
    projectId: 1,
    relativePath: 'doc.md',
    anchor,
    snapshot: null,
    resolved: false,
    createdAt: '2026-01-01 00:00:00',
    updatedAt: '2026-01-01 00:00:00',
    notes: [],
  };
}
