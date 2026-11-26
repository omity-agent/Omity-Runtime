import { type ComponentProps, createElement } from "react";
import type { Components, ExtraProps } from "react-markdown";
import { css, cx, sva } from "styled-system/css";

const classes = sva({
    base: {
      cell: {
        borderColor: "border.default",
        borderWidth: "hairline",
        padding: "2",
        verticalAlign: "top",
      },
      headerCell: { background: "bg.canvas", fontWeight: "bold", textAlign: "left" },
      heading: {
        _first: { paddingBlockStart: "0" },
        paddingBlockStart: "2",
        textStyle: "markdownHeading",
      },
      image: {
        borderColor: "border.default",
        borderWidth: "hairline",
        display: "block",
        height: "auto",
        maxWidth: "full",
      },
      item: { _marker: { color: "fg.muted" }, minWidth: "0", overflowWrap: "anywhere" },
      list: { display: "grid", gap: "1", paddingInlineStart: "5" },
      paragraph: { minWidth: "0", overflowWrap: "anywhere" },
      quote: {
        borderInlineStartColor: "border.default",
        borderInlineStartWidth: "medium",
        color: "fg.muted",
        display: "grid",
        gap: "3",
        paddingInlineStart: "3",
      },
      rule: { borderBlockStartWidth: "hairline", borderColor: "border.default", width: "full" },
      table: { borderCollapse: "collapse", minWidth: "max", width: "full" },
    },
    slots: [
      "heading",
      "paragraph",
      "quote",
      "list",
      "item",
      "rule",
      "image",
      "table",
      "cell",
      "headerCell",
    ],
  })(),
  unordered = css({
    "&.contains-task-list": { listStyleType: "none", paddingInlineStart: "0" },
    listStyleType: "disc",
  }),
  ordered = css({ listStyleType: "decimal" }),
  minorHeading = cx(classes.heading, css({ "--heading-size": "{fontSizes.editor}" })),
  math = css({
    maxWidth: "full",
    overflowX: "auto",
    overflowY: "hidden",
    overscrollBehaviorX: "contain",
  }),
  checkboxSpace = css({ display: "inline-flex", paddingInlineEnd: "2", verticalAlign: "middle" });

function element<Tag extends keyof Components>(tag: Tag, className: string) {
  return function MarkupElement({
    node: _node,
    className: provided,
    ...props
  }: ComponentProps<Tag> & ExtraProps) {
    return createElement(tag, { ...props, className: cx(className, provided) });
  };
}

export const markupComponents = {
  blockquote: element("blockquote", classes.quote),
  h1: element("h1", cx(classes.heading, css({ "--heading-size": "{fontSizes.xl}" }))),
  h2: element("h2", cx(classes.heading, css({ "--heading-size": "{fontSizes.lg}" }))),
  h3: element("h3", classes.heading),
  h4: element("h4", minorHeading),
  h5: element("h5", minorHeading),
  h6: element("h6", minorHeading),
  hr: element("hr", classes.rule),
  img: element("img", classes.image),
  input: ({ node: _node, ...props }) =>
    createElement("span", { className: checkboxSpace }, createElement("input", props)),
  li: element("li", classes.item),
  ol: element("ol", cx(classes.list, ordered)),
  p: element("p", classes.paragraph),
  span: ({ node: _node, className, ...props }) =>
    createElement("span", {
      ...props,
      className: cx(className, className?.split(" ").includes("katex-display") && math),
    }),
  table: element("table", classes.table),
  td: element("td", classes.cell),
  th: element("th", cx(classes.cell, classes.headerCell)),
  ul: element("ul", cx(classes.list, unordered)),
} satisfies Components;
