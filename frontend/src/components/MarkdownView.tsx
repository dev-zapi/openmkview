import { Component, createMemo, type JSX } from 'solid-js';
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

/**
 * 从 JSX children 中递归提取纯文本。
 * SolidMarkdown 可能将 heading children 作为字符串、数字或嵌套 JSX 元素传入。
 */
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

/**
 * 生成 heading ID，与后端 extract_headings 函数保持一致。
 * 规则：
 * 1. 转为小写
 * 2. 只保留字母数字（含 Unicode）、空格、连字符
 * 3. 空格替换为连字符
 */
const generateHeadingId = (text: string): string => {
  return text
    .toLowerCase()
    .split('')
    .filter(c => /[\p{L}\p{N}\s-]/u.test(c))
    .join('')
    .replace(/\s+/g, '-');
};

/**
 * 从后端返回的 headings 数组构建一个查找结构。
 * 对于同名标题（相同 depth + text），按出现顺序依次返回 id。
 */
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

  // 为后端 headings 构建 id 查找表，content 或 headings 变化时重建
  const headingIdMap = createMemo(() => {
    return props.headings ? buildHeadingIdMap(props.headings) : new Map();
  });

  // 跟踪同名标题的消费进度（每次渲染时重置）
  const usedCounts = new Map<string, number>();

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

  /**
   * 渲染 heading 组件，添加 id 属性用于大纲跳转。
   * 优先从后端 headings 中查找匹配的 id，回退到自行生成。
   */
  const renderHeading = (level: number) => (headingProps: any) => {
    const tag = `h${level}` as keyof JSX.IntrinsicElements;
    const text = extractText(headingProps.children);
    const map = headingIdMap();

    let id: string | undefined;

    // 尝试用 text 在后端 headings 中查找
    // 后端的 clean_text 去掉了 markdown 标记（*_`[]），前端 extractText 拿到的是渲染后的纯文本
    // 两者应当一致
    const key = `${level}:${text}`;
    const ids = map.get(key);
    if (ids && ids.length > 0) {
      const usedCount = usedCounts.get(key) || 0;
      if (usedCount < ids.length) {
        id = ids[usedCount];
        usedCounts.set(key, usedCount + 1);
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
