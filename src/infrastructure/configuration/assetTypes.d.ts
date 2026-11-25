declare module "#settings/interface/interaction.yaml" {
  const preferences: {
    confirmWindowMs: number;
    copyFeedbackMs: number;
    recentSessions: number;
    recentWorkspaces: number;
    marquee: { msPerPixel: number; pauseMs: number };
    queryRetries: { mutations: number | boolean; queries: number | boolean };
    transcriptRetry: { minimumWaitMs: number; maxAttempts: number; maxWaitMs: number };
  };
  export default preferences;
}
declare module "#settings/interface/rendering.yaml" {
  const rendering: {
    code: { bufferSize: number; estimatedLineHeight: number };
    mermaid: { theme: NonNullable<import("mermaid").MermaidConfig["theme"]> };
    transcript: { bufferSize: number; followThreshold: number; minimumScrollbarWidthPx: number };
  };
  export default rendering;
}
declare module "#settings/interface/viewport.yaml" {
  const queries: Record<"coarse" | "compact" | "largeCanvas" | "short" | "topNav", string>;
  export default queries;
}
declare module "#settings/runtime/scheduling.yaml" {
  const scheduling: { modelRetryPollMs: number };
  export default scheduling;
}
declare module "#settings/transport/outbound.yaml" {
  const outbound: { bodyTimeout: number; headersTimeout: number };
  export default outbound;
}
declare module "#settings/transport/terminal.yaml" {
  const probes: {
    name: string;
    variables: string[];
    nonEmpty?: boolean;
    version?: string;
    term?: "kitty" | "alacritty";
  }[];
  export default probes;
}
