import { createCssVariablesTheme } from "shiki/core";
import { token } from "styled-system/tokens";

export const syntaxThemeName = "omity";
export const syntaxTheme = createCssVariablesTheme({
  name: syntaxThemeName,
  variableDefaults: {
    "ansi-black": token.var("colors.bg.canvas"),
    "ansi-blue": token.var("colors.syntax.meta"),
    "ansi-bright-black": token.var("colors.fg.muted"),
    "ansi-bright-blue": token.var("colors.syntax.meta"),
    "ansi-bright-cyan": token.var("colors.syntax.title"),
    "ansi-bright-green": token.var("colors.syntax.addition"),
    "ansi-bright-magenta": token.var("colors.syntax.keyword"),
    "ansi-bright-red": token.var("colors.syntax.deletion"),
    "ansi-bright-white": token.var("colors.fg.default"),
    "ansi-bright-yellow": token.var("colors.syntax.number"),
    "ansi-cyan": token.var("colors.syntax.title"),
    "ansi-green": token.var("colors.syntax.addition"),
    "ansi-magenta": token.var("colors.syntax.keyword"),
    "ansi-red": token.var("colors.syntax.deletion"),
    "ansi-white": token.var("colors.fg.default"),
    "ansi-yellow": token.var("colors.syntax.number"),
    background: token.var("colors.bg.canvas"),
    foreground: token.var("colors.fg.default"),
    "token-changed": token.var("colors.syntax.meta"),
    "token-comment": token.var("colors.syntax.comment"),
    "token-constant": token.var("colors.syntax.number"),
    "token-deleted": token.var("colors.syntax.deletion"),
    "token-function": token.var("colors.syntax.title"),
    "token-inserted": token.var("colors.syntax.addition"),
    "token-keyword": token.var("colors.syntax.keyword"),
    "token-link": token.var("colors.syntax.meta"),
    "token-parameter": token.var("colors.syntax.property"),
    "token-punctuation": token.var("colors.fg.default"),
    "token-string": token.var("colors.syntax.string"),
    "token-string-expression": token.var("colors.syntax.string"),
  },
});
