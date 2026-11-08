import rehypeKatex from "rehype-katex";
import remarkCjkFriendlyGfmStrikethrough from "remark-cjk-friendly-gfm-strikethrough/parseOnly";
import remarkCjkFriendly from "remark-cjk-friendly/parseOnly";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

export const markdownPlugins = [
  remarkGfm,
  remarkCjkFriendly,
  remarkCjkFriendlyGfmStrikethrough,
  remarkMath,
];
export const markdownRehypePlugins = [rehypeKatex];
export const transcriptWindow = {
  bufferSize: 384,
  followThreshold: 48,
};
export const codeWindow = {
  bufferSize: 192,
  estimatedLineHeight: 24,
};
