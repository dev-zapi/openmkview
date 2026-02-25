import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeReact from "rehype-react";
import { createElement, Fragment } from "react";
import type { HeadingInfo } from "@/types";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jsxRuntime = require("react/jsx-runtime");
const { jsx, jsxs } = jsxRuntime;

interface ProcessedMarkdown {
  content: React.ReactElement;
  headings: HeadingInfo[];
}

function generateId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
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
      },
    })
    .process(markdown);

  return {
    content: result.result as React.ReactElement,
    headings,
  };
}

function createHeadingComponent(level: number) {
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function HeadingComponent(props: any) {
    const text =
      typeof props.children === "string"
        ? props.children
        : getTextContent(props.children);
    const id = generateId(text);
    return createElement(Tag, { ...props, id });
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getTextContent(children: any): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) {
    return children.map(getTextContent).join("");
  }
  if (children?.props?.children) {
    return getTextContent(children.props.children);
  }
  return "";
}
