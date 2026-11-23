import rendering from "#settings/interface/rendering.yaml";
import viewport from "#settings/interface/viewport.yaml";

export { default as uiBehavior } from "#settings/interface/interaction.yaml";

export const { code: codeWindow, transcript: transcriptWindow } = rendering;
export const compactViewport = viewport.compact;
