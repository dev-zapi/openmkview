"use client";

import { useState, useCallback, useRef } from "react";
import { Check, Copy } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getTextContent(node: any): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(getTextContent).join("");
  if (node?.props?.children) return getTextContent(node.props.children);
  return "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getLanguageFromChildren(children: any): string | null {
  if (!children) return null;

  const child = Array.isArray(children) ? children[0] : children;
  if (!child?.props) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props = child.props as Record<string, any>;

  const className = props.className;
  if (typeof className === "string") {
    const match = className.match(/language-(\S+)/);
    if (match) return match[1];
  }

  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function CodeBlock(props: any) {
  const { children, className, ...rest } = props;
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isShikiBlock =
    typeof className === "string" && className.includes("shiki");

  const language = isShikiBlock ? getLanguageFromChildren(children) : null;
  const codeText = isShikiBlock ? getTextContent(children) : "";

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(codeText);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = codeText;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), 2000);
  }, [codeText]);

  // For non-Shiki pre blocks, render as a plain <pre>
  if (!isShikiBlock) {
    return (
      <pre className={className} {...rest}>
        {children}
      </pre>
    );
  }

  return (
    <div className="code-block-wrapper group relative">
      {/* Header bar with language label and copy button */}
      <div className="code-block-header">
        {language && (
          <span className="code-block-lang">{language}</span>
        )}
        <button
          type="button"
          onClick={handleCopy}
          className="code-block-copy"
          aria-label={copied ? "Copied" : "Copy code"}
          title={copied ? "Copied!" : "Copy code"}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      <pre className={className} {...rest}>
        {children}
      </pre>
    </div>
  );
}
