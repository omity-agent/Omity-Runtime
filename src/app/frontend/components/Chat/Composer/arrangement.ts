import { css } from "styled-system/css";
import { hstack } from "styled-system/patterns";

import { conversationLane, stableScrollbar } from "../layout";

const surface = css.raw({
  background: "bg.default",
  display: "grid",
  gridTemplateRows: "minmax(0, 1fr)",
  maxBlockSize: "composerLimit",
  overflow: "hidden",
});
export const composerDock = css(surface, stableScrollbar);
export const draftDock = css(surface);
export const composerLayout = css(conversationLane, {
  display: "grid",
  gap: "2",
  gridTemplateRows: "minmax(0, 1fr) auto",
  minHeight: "0",
  paddingBlock: "2",
});
export const composerInput = css({
  minHeight: "0",
  minWidth: "0",
  overflowY: "auto",
  scrollbarWidth: "thin",
});
export const composerActions = hstack({ columnGap: "3", flexWrap: "wrap", rowGap: "1" });
export const composerControls = hstack({
  borderWidth: "0",
  flexGrow: 1,
  flexWrap: "wrap",
  gap: "1",
  justifyContent: "flex-end",
  minWidth: "0",
  padding: "0",
});
export const runtimeControls = hstack({
  borderWidth: "0",
  flexShrink: 0,
  gap: "1",
  minWidth: "0",
  padding: "0",
});
