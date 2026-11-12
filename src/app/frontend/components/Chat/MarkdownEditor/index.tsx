import { markdown } from "@codemirror/lang-markdown";
import { indentUnit } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { indentationMarkers } from "@replit/codemirror-indentation-markers";
import CodeMirror from "@uiw/react-codemirror";
import { useLayoutEffect, useMemo, useReducer } from "react";
import { token } from "styled-system/tokens";

import { markdownSyntax } from "../../Markdown/syntax";
import type { HistoryDirection } from "../Composer/history";
import { EditorHandlerStore, editorInteractions } from "./interactions";
import { editorFrame, editorTheme, editorWrapper, fixedTheme, fluidTheme } from "./presentation";

const basicSetup = {
  autocompletion: false,
  foldGutter: false,
  highlightActiveLine: true,
  highlightActiveLineGutter: true,
  lineNumbers: true,
};
export function MarkdownEditor({
  bare = false,
  disabled,
  fill = false,
  fluid = false,
  label,
  onChange,
  onPasteFiles,
  onHistoryNavigate,
  onPredictionNavigate,
  onSubmit,
  placeholder,
  value,
}: {
  bare?: boolean;
  disabled: boolean;
  fill?: boolean;
  fluid?: boolean;
  label?: string;
  onChange: (value: string) => void;
  onPasteFiles?: (files: File[]) => string | undefined;
  onHistoryNavigate?: (direction: HistoryDirection) => string | undefined;
  onPredictionNavigate?: () => string | undefined;
  onSubmit: () => void;
  placeholder: string;
  value: string;
}) {
  const [handlers] = useReducer(
    (current: EditorHandlerStore) => current,
    undefined,
    () =>
      new EditorHandlerStore({
        disabled,
        onHistoryNavigate,
        onPasteFiles,
        onPredictionNavigate,
        onSubmit,
      }),
  );
  useLayoutEffect(() => {
    handlers.update({
      disabled,
      onHistoryNavigate,
      onPasteFiles,
      onPredictionNavigate,
      onSubmit,
    });
  }, [disabled, handlers, onHistoryNavigate, onPasteFiles, onPredictionNavigate, onSubmit]);
  const extensions = useMemo(
    () => [
      markdown(),
      EditorState.tabSize.of(2),
      indentUnit.of("  "),
      EditorView.lineWrapping,
      indentationMarkers({
        colors: {
          activeDark: token.var("colors.fg.muted"),
          dark: token.var("colors.border.emphasized"),
        },
        hideFirstIndent: false,
        markerType: "fullScope",
      }),
      markdownSyntax,
      editorTheme,
      fluid ? fluidTheme : fixedTheme,
      ...editorInteractions(handlers.read),
    ],
    [fluid, handlers],
  );
  return (
    <div
      className={editorFrame({
        disabled,
        mode: fill ? "fill" : fluid ? "fluid" : "fixed",
        visual: bare ? "bare" : "outline",
      })}
    >
      <CodeMirror
        aria-label={label ?? placeholder}
        basicSetup={basicSetup}
        className={editorWrapper({ fill: !fluid || fill })}
        editable={!disabled}
        extensions={extensions}
        height={fluid && !fill ? "auto" : "100%"}
        indentWithTab
        onChange={onChange}
        placeholder={placeholder}
        readOnly={disabled}
        theme="none"
        value={value}
      />
    </div>
  );
}
