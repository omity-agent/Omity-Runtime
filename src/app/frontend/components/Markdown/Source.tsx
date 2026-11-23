import { Fragment, useLayoutEffect, useMemo, useRef } from "react";
import { css } from "styled-system/css";

import { localize } from "../../i18n";
import { codeLines, HighlightedLine } from "../HighlightedCode/lines";
import { fitSourceHeight, observeSourceSpace } from "./fittedSource";
import { source, sourceCode } from "./proseLayout";
import { highlightMarkdownSource } from "./syntax";

const container = css({ inset: "0", overflow: "clip", position: "absolute" });
export function MarkdownSource({ content }: { content: string }) {
  const lines = useMemo(() => codeLines(content, []), [content]),
    highlight = useMemo(() => highlightMarkdownSource(content), [content]),
    sourceReference = useRef<HTMLPreElement>(null),
    containerReference = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = sourceReference.current,
      parent = containerReference.current;
    if (!element || !parent) {
      throw new Error(localize("diagnostics:markdown.measureElementMissing"));
    }
    fitSourceHeight(element, parent.getBoundingClientRect().height);
  });
  useLayoutEffect(() => {
    const element = sourceReference.current,
      parent = containerReference.current;
    if (!element || !parent) {
      throw new Error(localize("diagnostics:markdown.sourceMeasureElementMissing"));
    }
    return observeSourceSpace(parent, element);
  }, []);
  return (
    <div className={container} ref={containerReference}>
      <pre className={source} ref={sourceReference}>
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
    </div>
  );
}
