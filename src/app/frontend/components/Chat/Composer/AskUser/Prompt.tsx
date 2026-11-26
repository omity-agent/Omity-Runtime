import { useTranslation } from "react-i18next";
import { css } from "styled-system/css";
import { grid, stack } from "styled-system/patterns";

import { MarkdownEditor } from "../../MarkdownEditor";
import type { AskUserQuestion } from "../../toolActions";
import { ChoiceOptions } from "./Options";

const choiceLayout = grid({ columns: { base: 1, md: 2 }, gap: "2", minWidth: "0" }),
  choicePane = stack({ background: "bg.canvas", borderRadius: "md", gap: "2", padding: "3" }),
  promptLabel = css({ color: "fg.default", textStyle: "formPrompt", whiteSpace: "pre-wrap" }),
  noteLabel = css({ color: "fg.muted", fontSize: "metadata" });
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
  const { t } = useTranslation("conversation");
  if (question.kind === "open_ended") {
    return (
      <div className={choicePane}>
        <p className={promptLabel}>{question.question}</p>
        <MarkdownEditor
          disabled={false}
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
      <section className={choicePane}>
        <p className={noteLabel}>{t("answerNote")}</p>
        <MarkdownEditor
          disabled={false}
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
