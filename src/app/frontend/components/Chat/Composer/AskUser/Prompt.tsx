import { useTranslation } from "react-i18next";
import { css, cx } from "styled-system/css";

import { MarkdownEditor } from "../../MarkdownEditor";
import type { AskUserQuestion } from "../../toolActions";
import { ChoiceOptions } from "./Options";

const choiceLayout = css({
    borderColor: "border.emphasized",
    borderWidth: "hairline",
    display: "grid",
    gridTemplateColumns: { base: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" },
    minHeight: "composerEditor",
    minWidth: "0",
  }),
  choicePane = css({
    alignContent: "start",
    display: "grid",
    gap: "3",
    minWidth: "0",
    padding: "3",
  }),
  promptLabel = css({
    color: "fg.default",
    textStyle: "formPrompt",
    whiteSpace: "pre-wrap",
  }),
  noteLabel = css({ color: "fg.muted", fontSize: "metadata" }),
  notePane = css({
    alignContent: "stretch",
    borderBlockStartWidth: { base: "hairline", md: "0" },
    borderInlineStartWidth: { md: "hairline" },
    borderLeftColor: { md: "border.emphasized" },
    borderTopColor: { base: "border.emphasized", md: "transparent" },
    gridTemplateRows: "auto minmax(0, 1fr)",
    minHeight: "0",
  });
export function AskUserPrompt({
  note,
  question,
  selectedOptions,
  onNoteChange,
  onOptionsChange,
  onSubmit,
}: {
  note: string;
  question: AskUserQuestion;
  selectedOptions: string[];
  onNoteChange: (note: string) => void;
  onOptionsChange: (options: string[]) => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();
  if (question.kind === "open_ended") {
    return (
      <div className={css({ display: "grid", gap: "2" })}>
        <p className={promptLabel}>{question.question}</p>
        <MarkdownEditor
          bare
          disabled={false}
          fluid
          label={question.question}
          onChange={onNoteChange}
          onSubmit={onSubmit}
          placeholder={t("answerPlaceholder")}
          value={note}
        />
      </div>
    );
  }
  return (
    <div className={choiceLayout}>
      <section className={choicePane}>
        <p className={promptLabel}>{question.question}</p>
        <ChoiceOptions
          question={question}
          selectedOptions={selectedOptions}
          onOptionsChange={onOptionsChange}
        />
      </section>
      <section className={cx(choicePane, notePane)}>
        <p className={noteLabel}>{t("answerNote")}</p>
        <MarkdownEditor
          bare
          disabled={false}
          fill
          label={t("answerNote")}
          onChange={onNoteChange}
          onSubmit={onSubmit}
          placeholder={t("answerNotePlaceholder")}
          value={note}
        />
      </section>
    </div>
  );
}
