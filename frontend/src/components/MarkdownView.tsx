import { Component, createMemo, createSignal, type JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { SolidMarkdown } from 'solid-markdown';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markdown';
import type { Heading } from '../types';

interface MarkdownViewProps {
  content: string;
  headings?: Heading[];
  class?: string;
}

const extractText = (children: any): string => {
  if (children == null) return '';
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(extractText).join('');
  if (typeof children === 'object' && children.props?.children) {
    return extractText(children.props.children);
  }
  return '';
};

const generateHeadingId = (text: string): string => {
  return text
    .toLowerCase()
    .split('')
    .filter(c => /[\p{L}\p{N}\s-]/u.test(c))
    .join('')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

const buildHeadingIdMap = (headings: Heading[]): Map<string, string[]> => {
  const map = new Map<string, string[]>();
  for (const h of headings) {
    const key = `${h.depth}:${h.text}`;
    const ids = map.get(key) || [];
    ids.push(h.id);
    map.set(key, ids);
  }
  return map;
};

const MarkdownView: Component<MarkdownViewProps> = (props) => {
  const renderedContent = createMemo(() => props.content);

  const headingIdMap = createMemo(() => {
    return props.headings ? buildHeadingIdMap(props.headings) : new Map();
  });

  const [usedCounts, setUsedCounts] = createSignal<Map<string, number>>(new Map());
  
  createMemo(() => {
    headingIdMap();
    setUsedCounts(new Map());
  });

  const extractCodeText = (children: any): string => {
    if (children == null) return '';
    if (typeof children === 'string') return children;
    if (typeof children === 'number') return String(children);
    if (typeof children === 'function') return extractCodeText(children());
    if (Array.isArray(children)) return children.map(extractCodeText).join('');
    if (typeof children === 'object' && children.props?.children) {
      return extractCodeText(children.props.children);
    }
    return '';
  };

  const renderCode = (codeProps: any) => {
    const { class: className, children } = codeProps;
    const language = className?.replace(/language-/, '') || 'text';

    const code = extractCodeText(children).replace(/\n$/, '');
    const highlighted = Prism.highlight(
      code,
      Prism.languages[language] || Prism.languages.text,
      language
    );

    return (
      <pre class={`language-${language}`}>
        <code class={`language-${language}`} innerHTML={highlighted} />
      </pre>
    );
  };

  const renderHeading = (level: number) => (headingProps: any) => {
    const tag = `h${level}` as keyof JSX.IntrinsicElements;
    const text = extractText(headingProps.children);
    const map = headingIdMap();

    let id: string | undefined;

    const key = `${level}:${text}`;
    const ids = map.get(key);
    if (ids && ids.length > 0) {
      const counts = usedCounts();
      const usedCount = counts.get(key) || 0;
      if (usedCount < ids.length) {
        id = ids[usedCount];
        const newCounts = new Map(counts);
        newCounts.set(key, usedCount + 1);
        setUsedCounts(newCounts);
      }
    }

    if (!id) {
      id = generateHeadingId(text);
    }

    return (
      <Dynamic component={tag} id={id}>
        {headingProps.children}
      </Dynamic>
    );
  };

  return (
    <div class={`markdown-view ${props.class || ''}`}>
      <SolidMarkdown
        children={renderedContent()}
        components={{
          code: renderCode,
          h1: renderHeading(1),
          h2: renderHeading(2),
          h3: renderHeading(3),
          h4: renderHeading(4),
          h5: renderHeading(5),
          h6: renderHeading(6),
        }}
      />
    </div>
  );
};

export default MarkdownView;
