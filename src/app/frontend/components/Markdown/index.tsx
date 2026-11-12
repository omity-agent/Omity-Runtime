import "katex/dist/katex.min.css";
import type { Root } from "hast";
import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { SKIP, visit } from "unist-util-visit";

import { markdownPlugins, markdownRehypePlugins } from "../../../../../settings/rendering";
import type { FilePathMatch } from "../../../../fileLinks/types";
import { normalizeCodeMatches, normalizeLineBreaks } from "../FileLink/lineBreaks";
import { fileLinkRemark } from "../FileLink/markdown";
import { useMarkdownSource } from "./DisplayMode";
import { region, rendered } from "./proseLayout";
import { blockComponents, inlineComponents, MarkdownContext, noFileLinks } from "./Renderers";
import { MarkdownSource } from "./Source";

export function MarkdownView({
  content,
  fileLinks = noFileLinks,
  preserveLineBreaks = false,
}: {
  content: string;
  fileLinks?: FilePathMatch[];
  preserveLineBreaks?: boolean;
}) {
  const normalized = useMemo(() => {
      const result = normalizeCodeMatches(content, fileLinks);
      return {
        content: result.code,
        context: { fileLinks: result.matches, source: result.code },
        remarkPlugins: [
          ...markdownPlugins,
          fileLinkRemark(result.matches),
          ...(preserveLineBreaks ? [remarkBreaks] : []),
        ],
      };
    }, [content, fileLinks, preserveLineBreaks]),
    showSource = useMarkdownSource();
  return (
    <MarkdownContext.Provider value={normalized.context}>
      <div className={region}>
        <div aria-hidden={showSource} className={rendered} data-source-visible={showSource}>
          <ReactMarkdown
            components={blockComponents}
            rehypePlugins={markdownRehypePlugins}
            remarkPlugins={normalized.remarkPlugins}
          >
            {normalized.content}
          </ReactMarkdown>
        </div>
        {showSource ? <MarkdownSource content={normalized.content} /> : null}
      </div>
    </MarkdownContext.Provider>
  );
}

export function MarkdownInline({ content }: { content: string }) {
  const normalized = useMemo(() => {
      const source = normalizeLineBreaks(content);
      return { context: { fileLinks: noFileLinks, source }, source };
    }, [content]),
    showSource = useMarkdownSource();
  if (showSource) {
    return normalized.source;
  }
  return (
    <MarkdownContext.Provider value={normalized.context}>
      <ReactMarkdown
        components={inlineComponents}
        rehypePlugins={inlineRehypePlugins}
        remarkPlugins={markdownPlugins}
      >
        {normalized.source}
      </ReactMarkdown>
    </MarkdownContext.Provider>
  );
}

const inlineElements = new Set(["code", "del", "em", "strong"]),
  inlineRehypePlugins = [inlineMarkdown, ...markdownRehypePlugins];
function inlineMarkdown() {
  return (tree: Root) => {
    visit(tree, "element", (node, index, parent) => {
      if (Array.isArray(node.properties.className)) {
        node.properties.className = node.properties.className.filter(
          (name) => name !== "math-display",
        );
      }
      if (parent && index !== undefined && !inlineElements.has(node.tagName)) {
        parent.children.splice(index, 1, ...node.children);
        return [SKIP, index];
      }
      return;
    });
  };
}
