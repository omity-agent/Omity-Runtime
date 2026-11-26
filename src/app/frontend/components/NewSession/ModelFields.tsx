import { Cpu, Layers } from "lucide-react";
import { type ChangeEvent, useCallback, useId } from "react";
import { useTranslation } from "react-i18next";
import { css } from "styled-system/css";

import { Field, Input, Select } from "../ui";
import { fieldLabel, setupControl } from "./setupLayout";

const columns = css({
    display: "grid",
    gap: "3",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, {sizes.setupColumn}), 1fr))",
  }),
  profileControl = css(setupControl),
  modelControl = css(setupControl, {
    _invalid: { borderColor: "status.error" },
    fontFamily: "mono",
    textOverflow: "ellipsis",
  }),
  error = css({ color: "status.error", fontSize: "metadata" });

export function ModelFields({
  availableProfiles,
  disabled,
  model,
  modelDisabled,
  onModelChange,
  onProfileChange,
  profile,
}: {
  availableProfiles: string[];
  disabled: boolean;
  model: string;
  modelDisabled: boolean;
  onModelChange: (model: string) => void;
  onProfileChange: (profile?: string) => void;
  profile?: string;
}) {
  const { t } = useTranslation("preparation"),
    changeProfile = useCallback(
      (event: ChangeEvent<HTMLSelectElement>) => {
        onProfileChange(event.currentTarget.value || undefined);
      },
      [onProfileChange],
    );
  return (
    <div className={columns}>
      <Field.Root disabled={disabled}>
        <Field.Label className={fieldLabel}>
          <Layers aria-hidden />
          {t("profile")}
        </Field.Label>
        <Select
          className={profileControl}
          name="profile"
          onChange={changeProfile}
          value={profile ?? ""}
        >
          <option value="">{t("defaultProfile")}</option>
          {availableProfiles.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
      </Field.Root>
      <ModelInput disabled={disabled || modelDisabled} model={model} onChange={onModelChange} />
    </div>
  );
}
function ModelInput({
  disabled,
  model,
  onChange,
}: {
  disabled: boolean;
  model: string;
  onChange: (model: string) => void;
}) {
  const { t } = useTranslation("preparation"),
    errorId = useId(),
    invalid = !disabled && model.trim().length === 0,
    change = useCallback(
      (event: ChangeEvent<HTMLInputElement>) => onChange(event.currentTarget.value),
      [onChange],
    );
  return (
    <Field.Root disabled={disabled} invalid={invalid}>
      <Field.Label className={fieldLabel}>
        <Cpu aria-hidden />
        {t("model")}
      </Field.Label>
      <Input
        aria-describedby={invalid ? errorId : undefined}
        autoCapitalize="none"
        autoComplete="off"
        className={modelControl}
        name="model"
        onChange={change}
        required
        spellCheck={false}
        value={model}
      />
      {invalid && (
        <span className={error} id={errorId}>
          {t("modelRequired")}
        </span>
      )}
    </Field.Root>
  );
}
