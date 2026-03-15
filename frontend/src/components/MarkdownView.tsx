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

  return (
    <div class={`markdown-view ${props.class || ''}`}>
      <SolidMarkdown
        children={renderedContent()}
        components={{
          code: renderCode,
        }}
      />
    </div>
  );
};

export default MarkdownView;
