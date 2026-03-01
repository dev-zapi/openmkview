import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeShiki from "@shikijs/rehype";
import rehypeReact from "rehype-react";
import { createElement, Fragment, isValidElement, type ReactNode } from "react";
import type { HeadingInfo } from "@/types";
import { CodeBlock } from "@/components/markdown-viewer/code-block";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jsxRuntime = require("react/jsx-runtime");
const { jsx, jsxs } = jsxRuntime;

interface ProcessedMarkdown {
  content: React.ReactElement;
  headings: HeadingInfo[];
}

interface HeadingComponentProps {
  children?: ReactNode;
  className?: string;
  [key: string]: unknown;
}

// Type for rehype-react options to avoid complex generic inference
type RehypeReactOptions = Parameters<typeof rehypeReact>[0];

function generateId(text: string): string {
  // Support both English and non-ASCII characters (like Chinese)
  const normalized = text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
  
  // If result is empty (all special chars removed), use hash of original text
  if (!normalized || normalized === "-") {
    return `heading-${hashCode(text)}`;
  }
  
  return normalized;
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export function extractHeadings(markdown: string): HeadingInfo[] {
  const headings: HeadingInfo[] = [];
  const lines = markdown.split("\n");

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const depth = match[1].length;
      const text = match[2].replace(/[*_`~\[\]]/g, "").trim();
      headings.push({
        id: generateId(text),
        text,
        depth,
      });
    }
  }

  return headings;
}

export async function processMarkdown(
  markdown: string
): Promise<ProcessedMarkdown> {
  const headings = extractHeadings(markdown);

  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeShiki, {
      themes: {
        light: "github-light",
        dark: "github-dark",
      },
      defaultColor: false,
    })
    .use(rehypeReact, {
      createElement,
      Fragment,
      jsx,
      jsxs,
      components: {
        h1: createHeadingComponent(1),
        h2: createHeadingComponent(2),
        h3: createHeadingComponent(3),
        h4: createHeadingComponent(4),
        h5: createHeadingComponent(5),
        h6: createHeadingComponent(6),
        pre: CodeBlock,
      },
    } as unknown as RehypeReactOptions)
    .process(markdown);

  return {
    content: result.result as React.ReactElement,
    headings,
  };
}

function createHeadingComponent(level: number) {
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  return function HeadingComponent(props: HeadingComponentProps) {
    const text =
      typeof props.children === "string"
        ? props.children
        : getTextContent(props.children);
    const id = generateId(text);
    return createElement(Tag, { ...props, id });
  };
}

function getTextContent(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) {
    return children.map(getTextContent).join("");
  }
  if (isValidElement(children) && children.props?.children) {
    return getTextContent(children.props.children as ReactNode);
  }
  return "";
}
