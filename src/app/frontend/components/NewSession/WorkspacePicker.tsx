import { Check, FolderOpen, History } from "lucide-react";
import { type ChangeEvent, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { css } from "styled-system/css";

import { reportPromiseErrors } from "../../services/errors";
import { Button, Field, Input } from "../ui";

const row = css({
    display: "grid",
    gap: "2",
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      sm: "minmax(0, 1fr) auto",
    },
    minWidth: "0",
  }),
  pathInput = css({ minWidth: "0", textOverflow: "ellipsis" }),
  recent = css({
    display: "grid",
    gap: "2",
    gridTemplateColumns: "minmax(0, 1fr)",
    minWidth: "0",
  }),
  recentLabel = css({ color: "fg.subtle", fontSize: "metadata" }),
  recentList = css({
    display: "grid",
    gap: "2",
    gridTemplateColumns: "minmax(0, 1fr)",
    minWidth: "0",
  }),
  recentButton = css({
    justifyContent: "flex-start",
    maxWidth: "full",
    minWidth: "0",
    width: "full",
  }),
  recentPath = css({
    minWidth: "0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  });
async function pickWorkspace(
  onPick: () => Promise<string | null>,
  onChange: (workspace: string) => void,
  setPicking: (picking: boolean) => void,
) {
  setPicking(true);
  try {
    const selected = await onPick();
    if (selected) {
      onChange(selected);
    }
  } finally {
    setPicking(false);
  }
}
export function WorkspacePicker({
  recentWorkspaces,
  className,
  disabled = false,
  workspace,
  onChange,
  onPick,
}: {
  className?: string;
  disabled?: boolean;
  recentWorkspaces: string[];
  workspace: string;
  onChange: (workspace: string) => void;
  onPick: () => Promise<string | null>;
}) {
  const { t } = useTranslation(),
    [picking, setPicking] = useState(false),
    handlePick = useCallback(() => {
      reportPromiseErrors(pickWorkspace(onPick, onChange, setPicking));
    }, [onChange, onPick, setPicking]),
    handleInputChange = useCallback(
      (event: ChangeEvent<HTMLInputElement>) => {
        onChange(event.currentTarget.value);
      },
      [onChange],
    );
  return (
    <Field.Root className={className} disabled={disabled}>
      <Field.Label>{t("workspace")}</Field.Label>
      <span className={row}>
        <Input
          className={pathInput}
          name="workspace"
          value={workspace}
          onChange={handleInputChange}
        />
        <Button disabled={disabled || picking} onClick={handlePick} type="button">
          <FolderOpen size={14} /> {t("chooseFolder")}
        </Button>
      </span>
      {recentWorkspaces.length > 0 ? (
        <div className={recent}>
          <span className={recentLabel}>{t("recentWorkspaces")}</span>
          <div className={recentList}>
            {recentWorkspaces.map((item) => (
              <RecentWorkspaceButton
                disabled={disabled}
                item={item}
                key={item}
                selected={item === workspace}
                onChange={onChange}
              />
            ))}
          </div>
        </div>
      ) : null}
    </Field.Root>
  );
}
function RecentWorkspaceButton({
  disabled,
  item,
  selected,
  onChange,
}: {
  disabled: boolean;
  item: string;
  selected: boolean;
  onChange: (workspace: string) => void;
}) {
  const select = useCallback(() => {
    onChange(item);
  }, [item, onChange]);
  return (
    <Button
      aria-pressed={selected}
      className={recentButton}
      disabled={disabled}
      onClick={select}
      title={item}
      type="button"
    >
      {selected ? <Check size={14} /> : <History size={14} />}
      <span className={recentPath}>{item}</span>
    </Button>
  );
}
