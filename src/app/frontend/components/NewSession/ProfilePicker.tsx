import { type ChangeEvent, useCallback } from "react";

import { useTranslation } from "../../i18n";
import { Field, Select } from "../ui";

export function ProfilePicker({
  available,
  disabled = false,
  selected,
  onChange,
}: {
  available: string[];
  disabled?: boolean;
  selected?: string;
  onChange: (profile?: string) => void;
}) {
  const { t } = useTranslation(),
    change = useCallback(
      (event: ChangeEvent<HTMLSelectElement>) => {
        onChange(event.target.value || undefined);
      },
      [onChange],
    );
  return (
    <Field.Root disabled={disabled}>
      <Field.Label>{t("preparation:profile")}</Field.Label>
      <Select name="profile" onChange={change} value={selected ?? ""}>
        <option value="">{t("preparation:defaultProfile")}</option>
        {available.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </Select>
    </Field.Root>
  );
}
