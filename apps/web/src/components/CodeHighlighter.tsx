import type { ReactNode } from "react";
import ShikiHighlighter, { isInlineCode, type Element } from "react-shiki";

type CodeHighlightProps = {  
  className?: string;
  children?: ReactNode;
  node?: Element;
} & React.HTMLAttributes<HTMLElement>;

export const CodeHighlight = ({ className, children, node, ...props }: CodeHighlightProps) => {
  const code = String(children).trim();
  const match = className?.match(/language-(\w+)/);
  const language = match ? match[1] : undefined;
  const isInline = node ? isInlineCode(node) : undefined;

  return !isInline ? (
    <ShikiHighlighter language={language} theme="github-dark" {...props}>
      {code}
    </ShikiHighlighter>
  ) : (
    <code className={className} {...props}>
      {code}
    </code>
  );
};
