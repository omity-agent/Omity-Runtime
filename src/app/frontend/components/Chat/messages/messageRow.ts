import { css, sva } from "styled-system/css";

import { conversationLane } from "../layout";

const marker = css.raw({
  content: '""',
  insetBlock: "0",
  pointerEvents: "none",
  position: "absolute",
  width: "0.5",
});

export const messageRow = sva({
  base: {
    actions: { alignItems: "center", display: "flex", gap: "1", justifyContent: "flex-end" },
    content: {
      '&[data-first="true"]': { minHeight: "controlTarget" },
      display: "grid",
      gap: "2",
      minWidth: "0",
    },
    inner: {
      ...conversationLane,
      '&[data-last="true"]': { paddingBlockEnd: "2" },
      alignItems: "start",
      columnGap: "2",
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) auto",
      paddingBlockStart: "2",
    },
    root: { "--inset-surface": "{colors.bg.default}", minWidth: "0", position: "relative" },
  },
  defaultVariants: { emphasized: false, pending: false, role: "assistant" },
  slots: ["root", "inner", "content", "actions", "action"],
  variants: {
    emphasized: {
      true: { root: { "--inset-surface": "{colors.bg.canvas}", background: "bg.default" } },
    },
    pending: { true: { inner: { opacity: 0.65 } } },
    role: {
      assistant: {
        inner: { gridTemplateColumns: "minmax(0, 1fr) {sizes.controlTarget}" },
        root: { _before: { ...marker, background: "speaker.assistant", insetInlineEnd: "4" } },
      },
      system: { content: { color: "fg.muted", fontSize: "sm" } },
      tool: {},
      user: {
        action: { color: "speaker.user" },
        content: { justifySelf: "end", maxWidth: "full", width: "fit" },
        root: { _before: { ...marker, background: "speaker.user", insetInlineStart: "0" } },
      },
    },
  },
});
