import {
  type ComponentProps,
  createContext,
  createElement,
  type ReactNode,
  useContext,
} from "react";
import type { Components, ExtraProps } from "react-markdown";
import { css } from "styled-system/css";

import type { FilePathMatch } from "../../../../fileLinks/types";
import { localize } from "../../i18n";
import { localizeMatches, matchInsideNode, pathFromFileLinkHref } from "../FileLink/markdown";
import { FileLinkMenu } from "../FileLink/Menu";
import { HighlightedCode } from "../HighlightedCode";
import { Code } from "../ui";
import { markupComponents } from "./Markup";
import { tableScroll } from "./proseLayout";

interface MarkdownRenderContext {
  fileLinks: FilePathMatch[];
  source: string;
}
export const MarkdownContext = createContext<MarkdownRenderContext | undefined>(undefined);
export const noFileLinks: FilePathMatch[] = [];
const MarkdownLinkContext = createContext(false),
  link = css({
    _focusVisible: { layerStyle: "focusRing" },
    _hover: { color: "fg.default" },
    color: "fg.link",
    textDecoration: "underline",
    textUnderlineOffset: "0.15em",
  });

function codeText(value: ReactNode): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return value.toString();
  }
  return Array.isArray(value) ? value.map(codeText).join("") : "";
}

function MarkdownAnchor({ children, href, node, ...props }: ComponentProps<"a"> & ExtraProps) {
  const { fileLinks } = useMarkdownRenderContext(),
    linkedPath = pathFromFileLinkHref(href),
    match =
      matchInsideNode(node, fileLinks) ??
      fileLinks.find((candidate) => candidate.path === linkedPath);
  return (
    <MarkdownLinkContext value>
      {match === undefined ? (
        createElement(
          "a",
          { ...props, className: link, href, rel: "noopener noreferrer", target: "_blank" },
          children,
        )
      ) : (
        <FileLinkMenu kind={match.kind} path={match.path}>
          {children}
        </FileLinkMenu>
      )}
    </MarkdownLinkContext>
  );
}

function MarkdownCode({ children, className, node }: ComponentProps<"code"> & ExtraProps) {
  const { fileLinks, source } = useMarkdownRenderContext(),
    insideLink = useContext(MarkdownLinkContext),
    raw = codeText(children),
    code = raw.replace(/\n$/, ""),
    matches = insideLink ? noFileLinks : localizeMatches(code, source, node, fileLinks),
    language = className?.match(/(?:^|\s)language-(?<language>[^\s]+)/)?.groups?.["language"];
  if (className || raw.includes("\n")) {
    return (
      <HighlightedCode code={code} fileLinkMatches={matches} language={language} layout="flow" />
    );
  }
  const codeNode = <Code>{children}</Code>,
    [match] = matches;
  return match ? (
    <FileLinkMenu kind={match.kind} path={match.path}>
      {codeNode}
    </FileLinkMenu>
  ) : (
    codeNode
  );
}

function MarkdownPre({ children }: ComponentProps<"pre"> & ExtraProps) {
  return <>{children}</>;
}
function MarkdownTable(props: ComponentProps<"table"> & ExtraProps) {
  return <div className={tableScroll}>{createElement(markupComponents.table, props)}</div>;
}
function useMarkdownRenderContext() {
  const context = useContext(MarkdownContext);
  if (!context) {
    throw new Error(localize("diagnostics:markdown.contextMissing"));
  }
  return context;
}

export const blockComponents = {
  ...markupComponents,
  a: MarkdownAnchor,
  code: MarkdownCode,
  pre: MarkdownPre,
  table: MarkdownTable,
} satisfies Components;
export const inlineComponents = { code: MarkdownCode } satisfies Components;
