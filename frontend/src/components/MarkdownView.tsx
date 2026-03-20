import { Component, createMemo } from 'solid-js';
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

interface MarkdownViewProps {
  content: string;
  class?: string;
}

/**
 * 生成 heading ID，与后端 extract_headings 函数保持一致
 * 规则：
 * 1. 转为小写
 * 2. 只保留字母数字、空格、连字符
 * 3. 空格替换为连字符
 */
const generateHeadingId = (text: string): string => {
  return text
    .toLowerCase()
    .split('')
    .filter(c => /[a-z0-9\s-]/.test(c))
    .join('')
    .replace(/\s+/g, '-');
};

const MarkdownView: Component<MarkdownViewProps> = (props) => {
  const renderedContent = createMemo(() => props.content);

  const renderCode = (codeProps: any) => {
    const { class: className, children } = codeProps;
    const language = className?.replace(/language-/, '') || 'text';

    const code = String(children).replace(/\n$/, '');
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
   * 渲染 heading 组件，添加 id 属性用于大纲跳转
   */
  const renderHeading = (level: number) => (headingProps: any) => {
    const Tag = `h${level}` as keyof JSX.IntrinsicElements;
    const text = String(headingProps.children || '');
    const id = generateHeadingId(text);

    return <Tag id={id}>{headingProps.children}</Tag>;
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
