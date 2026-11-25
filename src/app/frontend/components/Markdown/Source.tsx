import { createContext, Fragment, useMemo } from "react";

import { codeLines, HighlightedLine } from "../HighlightedCode/lines";
import { source, sourceCode } from "./proseLayout";
import { highlightMarkdownSource } from "./syntax";

export const MarkdownSourceContext = createContext(false);
export function MarkdownSource({ content }: { content: string }) {
  const lines = useMemo(() => codeLines(content, []), [content]),
    highlight = useMemo(() => highlightMarkdownSource(content), [content]);
  return (
    <pre className={source}>
      <code className={sourceCode}>
        {lines.map((line, index) => (
          <Fragment key={line.start}>
            <HighlightedLine
              appendOnly={false}
              highlight={highlight}
              line={line}
              lineIndex={index}
            />
            {index < lines.length - 1 ? "\n" : null}
          </Fragment>
        ))}
      </code>
    </pre>
  );
}
