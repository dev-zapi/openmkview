import { buildSourceProjection } from '../../utils/sourceMarkdownBlocks';
import { hashBlockContent } from '../../utils/blockModel';
import { resolveAnchor } from '../../utils/anchorResolver';
import { assignBlockAnchors } from '../../utils/annotationBlocks';
import {
  createMarkdownPipeline,
  sanitizeMarkdownHtml,
} from '../../utils/sanitizedMarkdown';
import type { BlockModel } from '../../utils/blockModel';

// The agent CLI is a zero-dependency runtime `.mjs` file with no bundled type
// declarations. Tests import its exported pure functions directly; Vitest
// transpiles the import, so a permissive module type is enough here.
// @ts-expect-error - omk.mjs intentionally ships without TypeScript types.
import * as omk from '../../../../skills/openmkview-annotations/scripts/omk.mjs';

interface OmkModule {
  normalizeBlockText: (text: string) => string;
  hashBlockContent: (input: string) => string;
  parseMarkdownBlocks: (
    markdown: string
  ) => { id: string; type: string; text: string; headingPath: string[] }[];
  buildAnchorFromMarkdown: (
    markdown: string,
    quote?: string | null
  ) => { version: number; segments: Record<string, unknown>[] };
  writeIdentity: (options: {
    author?: string;
    human?: boolean;
  }) => { author: string; isAgent: boolean };
  normalizeProject: (row: Record<string, unknown>) => {
    id: number;
    name: string;
    path: string;
    isOpen: boolean;
    createdAt: string | null;
    lastOpenedAt: string | null;
    color: string | null;
    icon: string | null;
  } | null;
  projectMatchesFor: (
    directory: string,
    projects: { id: number; name: string; path: string }[]
  ) => {
    project: { id: number; name: string; path: string };
    relation: 'root' | 'inside';
  }[];
}

const cli = omk as unknown as OmkModule;

/**
 * Builds the block model the frontend resolver sees, from the same raw
 * Markdown. This deliberately uses the frontend's own source projection and
 * hash formula (not the CLI parser) so the assertion is independent of the
 * code under test.
 */
function frontendBlocks(markdown: string): BlockModel[] {
  const projection = buildSourceProjection(markdown);
  const occurrences = new Map<string, number>();

  return projection.blocks
    .filter((block) => block.type !== 'frontmatter')
    .map((block) => {
      const key = `${block.type}\u0001${block.text}`;
      const occurrence = occurrences.get(key) ?? 0;
      occurrences.set(key, occurrence + 1);
      return {
        id: `blk-${hashBlockContent(`${key}\u0001${occurrence}`)}`,
        type: block.type,
        text: block.text,
        headingPath: block.headingPath,
      };
    });
}

function expectResolved(markdown: string, anchor: ReturnType<OmkModule['buildAnchorFromMarkdown']>) {
  const resolution = resolveAnchor(frontendBlocks(markdown), anchor as never);
  expect(resolution.status).toBe('resolved');
  if (resolution.status !== 'resolved') throw new Error('expected resolved anchor');
  return resolution;
}

/**
 * The real Preview block model: render Markdown exactly as the document view
 * does, then run the render pass that assigns block ids/heading paths. This
 * proves CLI anchors land Active against the actual DOM pipeline, not only
 * against the Source-view projection.
 */
function renderedBlocks(markdown: string): BlockModel[] {
  const html = sanitizeMarkdownHtml(
    createMarkdownPipeline().parse(markdown) as string
  );
  const root = document.createElement('div');
  root.innerHTML = html;
  return assignBlockAnchors(root).map((block) => block.model);
}

function expectResolvedInPreview(
  markdown: string,
  anchor: ReturnType<OmkModule['buildAnchorFromMarkdown']>
) {
  const resolution = resolveAnchor(renderedBlocks(markdown), anchor as never);
  expect(resolution.status).toBe('resolved');
  return resolution;
}

describe('omk.mjs anchor construction', () => {
  it('hashes block ids exactly like the render pass (FNV-1a + occurrence)', () => {
    const markdown = 'Same.\n\nSame.\n\n# Heading\n\nDifferent.';
    const cliBlocks = cli.parseMarkdownBlocks(markdown);
    const frontend = frontendBlocks(markdown);

    expect(cliBlocks.map((block) => block.id)).toEqual(
      frontend.map((block) => block.id)
    );
    expect(cliBlocks.map((block) => [block.type, block.text, block.headingPath])).toEqual(
      frontend.map((block) => [block.type, block.text, block.headingPath])
    );
    // Two identical blocks must carry different occurrence hashes.
    expect(cliBlocks[0].id).not.toBe(cliBlocks[1].id);
    // And the exported primitives agree with the frontend's implementation.
    expect(cli.normalizeBlockText('  a \n\t b  ')).toBe('a b');
    expect(cli.hashBlockContent('abc')).toBe(hashBlockContent('abc'));
  });

  it('resolves a quote taken from the middle of a paragraph', () => {
    const markdown = [
      '# Guide',
      '',
      'The quick brown fox jumps over the lazy dog and keeps running.',
      '',
    ].join('\n');

    const anchor = cli.buildAnchorFromMarkdown(markdown, 'quick brown');
    expect(anchor.version).toBe(1);
    expect(anchor.segments).toHaveLength(1);
    expect(anchor.segments[0]).toMatchObject({
      kind: 'text',
      blockType: 'p',
      blockText: 'The quick brown fox jumps over the lazy dog and keeps running.',
      quote: 'quick brown',
      prefix: 'The ',
    });

    const resolution = expectResolved(markdown, anchor);
    const segment = resolution.segments[0];
    expect(segment.kind).toBe('text');
    if (segment.kind === 'text') {
      expect(segment.quote).toBe('quick brown');
    }
  });

  it('resolves a quote in a paragraph nested under headings', () => {
    const markdown = [
      '# Guide',
      '',
      '## Setup',
      '',
      'Install the dependencies before starting the development server.',
      '',
      '### Details',
      '',
      'The server listens on port four five six seven by default.',
      '',
    ].join('\n');

    const anchor = cli.buildAnchorFromMarkdown(markdown, 'development server');
    expect(anchor.segments[0].headingPath).toEqual(['Guide', 'Setup']);

    const resolution = expectResolved(markdown, anchor);
    const block = frontendBlocks(markdown).find(
      (candidate) => candidate.id === resolution.segments[0].blockId
    );
    expect(block?.headingPath).toEqual(['Guide', 'Setup']);
  });

  it('resolves a quote inside a fenced code block', () => {
    const markdown = [
      '# Commands',
      '',
      '```bash',
      'npm install openmkview',
      'npm run dev',
      '```',
      '',
    ].join('\n');

    const anchor = cli.buildAnchorFromMarkdown(markdown, 'npm install openmkview');
    expect(anchor.segments[0]).toMatchObject({
      kind: 'text',
      blockType: 'code',
      blockText: 'npm install openmkview npm run dev',
    });

    const resolution = expectResolved(markdown, anchor);
    expect(resolution.segments).toHaveLength(1);
  });

  it('resolves one of two duplicate paragraphs by heading context', () => {
    const markdown = [
      '# Intro',
      '',
      'Alpha beta gamma is a repeated sentence.',
      '',
      '# Details',
      '',
      'Alpha beta gamma is a repeated sentence.',
      '',
    ].join('\n');

    const anchor = cli.buildAnchorFromMarkdown(markdown, 'Alpha beta gamma');
    expect(anchor.segments[0].headingPath).toEqual(['Intro']);

    const resolution = expectResolved(markdown, anchor);
    const blocks = frontendBlocks(markdown);
    const resolvedBlock = blocks.find(
      (block) => block.id === resolution.segments[0].blockId
    );
    expect(resolvedBlock?.headingPath).toEqual(['Intro']);
  });

  it('normalizes whitespace in the quote and stores the exact block slice', () => {
    const markdown = [
      '# Whitespace',
      '',
      'The   rendered   text has  collapsed spacing.',
      '',
    ].join('\n');

    const anchor = cli.buildAnchorFromMarkdown(
      markdown,
      'The rendered\ntext has collapsed'
    );
    expect(anchor.segments[0]).toMatchObject({
      kind: 'text',
      quote: 'The rendered text has collapsed',
    });

    expectResolved(markdown, anchor);
  });

  it('emits a whole-block anchor when the quote covers the entire block', () => {
    const markdown = [
      '# Title',
      '',
      'A standalone paragraph.',
      '',
    ].join('\n');

    const anchor = cli.buildAnchorFromMarkdown(markdown, 'A standalone paragraph.');
    expect(anchor.segments).toHaveLength(1);
    expect(anchor.segments[0]).toMatchObject({
      kind: 'block',
      blockText: 'A standalone paragraph.',
      blockType: 'p',
      headingPath: ['Title'],
    });

    expectResolved(markdown, anchor);
  });

  it('emits a whole-file anchor covering every block when the quote is omitted', () => {
    const markdown = [
      '# One',
      '',
      'First paragraph.',
      '',
      '## Two',
      '',
      'Second paragraph.',
      '',
    ].join('\n');

    const anchor = cli.buildAnchorFromMarkdown(markdown);
    expect(anchor.segments).toHaveLength(4);
    expect(anchor.segments.every((segment) => segment.kind === 'block')).toBe(true);

    const resolution = expectResolved(markdown, anchor);
    expect(resolution.segments).toHaveLength(4);
  });

  it('rejects a quote that is not present in the file', () => {
    expect(() =>
      cli.buildAnchorFromMarkdown('# Title\n\nHello world.', 'missing text')
    ).toThrow(/not found/i);
  });

  it('resolves through the real rendered Preview block model', () => {
    const markdown = [
      '# Guide',
      '',
      'The quick brown fox jumps over the lazy dog.',
      '',
      '## Setup',
      '',
      'Install the dependencies and run the development server.',
      '',
      '```bash',
      'npm install openmkview',
      'npm run dev',
      '```',
      '',
      'A standalone paragraph.',
      '',
    ].join('\n');

    for (const quote of [
      'quick brown fox',
      'development server',
      'npm install openmkview',
      'A standalone paragraph.',
    ]) {
      expectResolvedInPreview(markdown, cli.buildAnchorFromMarkdown(markdown, quote));
    }
  });

  it('mirrors rendered soft breaks, list continuations, setext headings, tables, and images', () => {
    // `breaks: true` turns soft line breaks into <br> (no text node), so
    // wrapped prose concatenates without a space. Lists keep a space only
    // between items; table cells keep one space; image alt text is not text.
    const markdown = [
      '# Wrapped prose',
      '',
      'The quick brown',
      'fox jumps over',
      'the lazy dog.',
      '',
      '## Quote',
      '',
      '> quote first line',
      '> quote second line',
      '',
      '## List',
      '',
      '- item first line',
      '  continuation line',
      '- second item',
      '',
      '## Table',
      '',
      '| A | B |',
      '|---|---|',
      '| C | D |',
      '',
      'Setext first line',
      'continued',
      '===',
      '',
      '## Images',
      '',
      'Text before ![alt text](pic.png) text after.',
      '',
    ].join('\n');

    const cliBlocks = cli.parseMarkdownBlocks(markdown).map(
      ({ id, type, text, headingPath }) => ({ id, type, text, headingPath })
    );
    const rendered = renderedBlocks(markdown).map(
      ({ id, type, text, headingPath }) => ({ id, type, text, headingPath })
    );
    expect(cliBlocks).toEqual(rendered);

    for (const quote of [
      'brownfox', // wrapped paragraph: no separator at the soft break
      'linequote', // wrapped blockquote: no separator
      'linecontinuation', // list item continuation: no separator
      'first linecontinued', // multi-line setext heading
      'C D', // table cells are space-separated
      'before text after', // image alt text is dropped
    ]) {
      expectResolvedInPreview(markdown, cli.buildAnchorFromMarkdown(markdown, quote));
    }
  });
});

describe('omk.mjs write identity', () => {
  it('defaults writes to the agent voice', () => {
    expect(cli.writeIdentity({})).toEqual({ author: 'agent', isAgent: true });
    expect(cli.writeIdentity({ author: '  claude  ' })).toEqual({
      author: 'claude',
      isAgent: true,
    });
  });

  it('--human overrides the agent flag and the default author', () => {
    expect(cli.writeIdentity({ human: true })).toEqual({
      author: 'human',
      isAgent: false,
    });
    expect(cli.writeIdentity({ author: 'Jonas', human: true })).toEqual({
      author: 'Jonas',
      isAgent: false,
    });
  });
});

describe('omk.mjs project helpers', () => {
  it('normalizes a snake_case project row to camelCase', () => {
    const normalized = cli.normalizeProject({
      id: 1,
      path: '/work/docs',
      name: 'docs',
      created_at: '2026-11-18 12:46:30',
      last_opened_at: '2026-11-18 12:50:00',
      is_open: 1,
      color: null,
      icon: null,
    });

    expect(normalized).toEqual({
      id: 1,
      name: 'docs',
      path: '/work/docs',
      isOpen: true,
      createdAt: '2026-11-18 12:46:30',
      lastOpenedAt: '2026-11-18 12:50:00',
      color: null,
      icon: null,
    });
  });

  it('booleanizes isOpen from the snake_case wire field', () => {
    expect(
      cli.normalizeProject({ id: 2, name: 'closed', path: '/closed', is_open: 0 })
        ?.isOpen
    ).toBe(false);
    expect(
      cli.normalizeProject({ id: 3, name: 'open', path: '/open', is_open: 1 })
        ?.isOpen
    ).toBe(true);
  });

  it('finds the root, nested, and unrelated directories', () => {
    const projects = [
      { id: 1, name: 'repo', path: '/work/repo' },
      { id: 2, name: 'docs', path: '/work/repo/docs' },
      { id: 3, name: 'other', path: '/work/other' },
    ];

    expect(cli.projectMatchesFor('/work/repo', projects)).toEqual([
      { project: projects[0], relation: 'root' },
    ]);
    expect(cli.projectMatchesFor('/work/repo/docs', projects)).toEqual([
      { project: projects[1], relation: 'root' },
      { project: projects[0], relation: 'inside' },
    ]);
    expect(cli.projectMatchesFor('/work/repo/docs/guide', projects)).toEqual([
      { project: projects[1], relation: 'inside' },
      { project: projects[0], relation: 'inside' },
    ]);
    expect(cli.projectMatchesFor('/work/elsewhere', projects)).toEqual([]);
  });

  it('orders nested matches deepest first', () => {
    const projects = [
      { id: 1, name: 'repo', path: '/work/repo' },
      { id: 2, name: 'docs', path: '/work/repo/docs' },
      { id: 3, name: 'site', path: '/work/repo/docs/site' },
    ];

    expect(
      cli
        .projectMatchesFor('/work/repo/docs/site/assets', projects)
        .map((match) => match.project.id)
    ).toEqual([3, 2, 1]);
  });
});
