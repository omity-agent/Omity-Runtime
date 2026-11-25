import { css } from "styled-system/css";

const shade = css.raw({
  _before: {
    backgroundImage:
      "linear-gradient(var(--shade-direction), color-mix(in srgb, {colors.fg.default} 18%, transparent), transparent)",
    content: '""',
    height: "4",
    insetInline: "0",
    position: "absolute",
  },
  height: "0",
  pointerEvents: "none",
  position: "sticky",
  width: "full",
  zIndex: "pinned",
});
export const startShade = css(shade, {
  "--shade-direction": "to bottom",
  _before: { insetBlockStart: "0" },
  insetBlockStart: "0",
  opacity: "var(--transcript-start, 0)",
});
export const endShade = css(shade, {
  "--shade-direction": "to top",
  _before: { insetBlockEnd: "0" },
  insetBlockEnd: "0",
  opacity: "var(--transcript-end, 0)",
});

export function updateOverflowCues(element: HTMLElement) {
  const { clientHeight, scrollHeight, scrollTop } = element;
  element.toggleAttribute("data-overflow-start", scrollTop >= 1);
  element.toggleAttribute("data-overflow-end", scrollHeight - clientHeight - scrollTop >= 1);
}
