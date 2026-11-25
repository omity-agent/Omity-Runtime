import mermaid from "mermaid";
import { nanoid } from "nanoid";
import { css } from "styled-system/css";

import rendering from "#settings/interface/rendering.yaml";

const staging = css({
  height: "0",
  overflow: "hidden",
  position: "fixed",
  visibility: "hidden",
  width: "0",
});
mermaid.initialize({
  htmlLabels: false,
  secure: [
    "arrowMarkerAbsolute",
    "htmlLabels",
    "maxEdges",
    "maxTextSize",
    "secure",
    "securityLevel",
    "startOnLoad",
    "suppressErrorRendering",
    "themeCSS",
  ],
  securityLevel: "strict",
  startOnLoad: false,
  suppressErrorRendering: true,
  theme: rendering.mermaid.theme,
});

export async function buildMermaidSvg(code: string) {
  const container = document.createElement("div");
  container.className = staging;
  container.setAttribute("aria-hidden", "true");
  document.body.append(container);
  try {
    const { svg } = await mermaid.render(`omity-diagram-${nanoid()}`, code, container);
    return svg;
  } finally {
    container.remove();
  }
}
