import { Check, LoaderCircle } from "lucide-react";
import { type ChangeEvent, useCallback, useEffect, useState } from "react";
import { css } from "styled-system/css";
import { visuallyHidden } from "styled-system/patterns";

import { useTranslation } from "../../../../i18n";
import { reportPromiseErrors } from "../../../../services/errors";
import { Field, IconButton, Select } from "../../../ui";

const action = css({
    alignItems: "center",
    display: "flex",
    gap: "1",
    minWidth: "0",
  }),
  field = css({
    alignItems: "center",
    display: "flex",
    flexDirection: "row",
    flexGrow: 1,
    gap: "1",
    minWidth: "0",
  }),
  select = css({
    flexGrow: 1,
    minWidth: "0",
    width: "full",
  }),
  busyIcon = css({ animationStyle: "busy" }),
  hiddenLabel = visuallyHidden();
export function ProfileAction({
  availableProfiles,
  currentProfile,
  disabled,
  pending,
  onChange,
}: {
  availableProfiles: string[];
  currentProfile?: string;
  disabled: boolean;
  pending: boolean;
  onChange: (profile?: string) => void | Promise<void>;
}) {
  const { t } = useTranslation(),
    [selectedProfile, setSelectedProfile] = useState(currentProfile),
    changed = selectedProfile !== currentProfile,
    change = useCallback(
      (event: ChangeEvent<HTMLSelectElement>) => {
        setSelectedProfile(event.target.value || undefined);
      },
      [setSelectedProfile],
    ),
    confirm = useCallback(() => {
      reportPromiseErrors(Promise.resolve(onChange(selectedProfile)));
    }, [onChange, selectedProfile]);
  useEffect(() => {
    setSelectedProfile(currentProfile);
  }, [currentProfile, setSelectedProfile]);
  return (
    <div className={action}>
      <Field.Root className={field} disabled={disabled || pending}>
        <Field.Label className={hiddenLabel}>{t("preparation:profile")}</Field.Label>
        <Select
          className={select}
          name="session-profile"
          onChange={change}
          value={selectedProfile ?? ""}
        >
          <option value="">{t("preparation:defaultProfile")}</option>
          {availableProfiles.map((profile) => (
            <option key={profile} value={profile}>
              {profile}
            </option>
          ))}
        </Select>
      </Field.Root>
      <IconButton
        aria-busy={pending}
        aria-label={t("conversation:confirmProfile")}
        disabled={disabled || pending || !changed}
        onClick={confirm}
        title={t("conversation:confirmProfile")}
        type="button"
      >
        {pending ? (
          <LoaderCircle aria-hidden className={busyIcon} size={16} />
        ) : (
          <Check aria-hidden size={16} />
        )}
      </IconButton>
    </div>
  );
}
