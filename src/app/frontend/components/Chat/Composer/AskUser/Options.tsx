import { Checkbox, RadioGroup } from "@ark-ui/react";
import { Check } from "lucide-react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { css } from "styled-system/css";
import { stack } from "styled-system/patterns";

import type { AskUserQuestion } from "../../toolActions";
import { choiceOption } from "./choiceOption";

const checkboxClasses = choiceOption({ kind: "checkbox" }),
  radioClasses = choiceOption({ kind: "radio" }),
  optionList = stack({ gap: "2" }),
  optionLabel = css({ color: "fg.muted", fontSize: "metadata" }),
  radioRoot = stack({ gap: "2" });
type ChoiceQuestion = Extract<AskUserQuestion, { kind: "choice" }>;
export function ChoiceOptions({
  question,
  selectedOptions,
  onOptionsChange,
}: {
  question: ChoiceQuestion;
  selectedOptions: string[];
  onOptionsChange: (options: string[]) => void;
}) {
  const { t } = useTranslation("conversation"),
    handleRadioChange = useCallback(
      ({ value }: { value: string | null }) => onOptionsChange(value ? [value] : []),
      [onOptionsChange],
    );
  if (question.multiple) {
    return (
      <div className={optionList}>
        {question.options.map((option) => (
          <MultipleOption
            key={option}
            option={option}
            selectedOptions={selectedOptions}
            onOptionsChange={onOptionsChange}
          />
        ))}
      </div>
    );
  }
  return (
    <RadioGroup.Root
      className={radioRoot}
      onValueChange={handleRadioChange}
      value={selectedOptions[0] ?? ""}
    >
      <RadioGroup.Label className={optionLabel}>{t("selectOne")}</RadioGroup.Label>
      <div className={optionList}>
        {question.options.map((option) => (
          <RadioGroup.Item className={radioClasses.root} key={option} value={option}>
            <RadioGroup.ItemHiddenInput />
            <RadioGroup.ItemControl className={radioClasses.control} />
            <RadioGroup.ItemText className={radioClasses.label}>{option}</RadioGroup.ItemText>
          </RadioGroup.Item>
        ))}
      </div>
    </RadioGroup.Root>
  );
}
function MultipleOption({
  option,
  selectedOptions,
  onOptionsChange,
}: {
  option: string;
  selectedOptions: string[];
  onOptionsChange: (options: string[]) => void;
}) {
  const handleCheckedChange = useCallback(
    ({ checked }: { checked: boolean | "indeterminate" }) => {
      const next = new Set(selectedOptions);
      if (checked === true) {
        next.add(option);
      } else {
        next.delete(option);
      }
      onOptionsChange([...next]);
    },
    [onOptionsChange, option, selectedOptions],
  );
  return (
    <Checkbox.Root
      checked={selectedOptions.includes(option)}
      className={checkboxClasses.root}
      onCheckedChange={handleCheckedChange}
    >
      <Checkbox.HiddenInput />
      <Checkbox.Control className={checkboxClasses.control}>
        <Checkbox.Indicator className={checkboxClasses.indicator}>
          <Check size={14} />
        </Checkbox.Indicator>
      </Checkbox.Control>
      <Checkbox.Label className={checkboxClasses.label}>{option}</Checkbox.Label>
    </Checkbox.Root>
  );
}
