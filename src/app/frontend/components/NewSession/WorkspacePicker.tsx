import { Check, Folder, FolderOpen, History } from "lucide-react";
import { type ChangeEvent, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { css } from "styled-system/css";

import { reportPromiseErrors } from "../../services/errors";
import { Button, Field, Input } from "../ui";
import { fieldLabel, setupControl, wrappingRow } from "./setupLayout";

const row = css({
    display: "grid",
    gap: "2",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    minWidth: "0",
  }),
  pathInput = css(setupControl, { fontFamily: "mono", textOverflow: "ellipsis" }),
  folderButton = css(setupControl, {
    _hover: { background: "bg.emphasized" },
    minWidth: "controlTarget",
    paddingInline: { base: "0", sm: "3" },
  }),
  folderText = css({ display: { base: "none", sm: "inline" } }),
  recent = css({
    display: "grid",
    gap: "1",
    gridColumn: "1 / -1",
    minWidth: "0",
  }),
  recentLabel = css({ color: "fg.muted", fontSize: "metadata" }),
  recentList = css(wrappingRow, { gap: "1" }),
  recentItem = css({ maxInlineSize: "full", minWidth: "0" }),
  recentButton = css({
    '&[aria-pressed="true"]': { background: "bg.default", color: "fg.default" },
    _focusVisible: { outlineOffset: "focusInset" },
    _hover: { background: "bg.emphasized", color: "fg.default" },
    borderRadius: "md",
    justifyContent: "flex-start",
    maxInlineSize: "full",
    minWidth: "0",
    paddingInline: "2",
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
  disabled = false,
  workspace,
  onChange,
  onPick,
}: {
  disabled?: boolean;
  workspace: string;
  onChange: (workspace: string) => void;
  onPick: () => Promise<string | null>;
}) {
  const { t } = useTranslation("preparation"),
    folderLabel = t("chooseFolder"),
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
    <Field.Root disabled={disabled}>
      <Field.Label className={fieldLabel}>
        <Folder aria-hidden />
        {t("workspace")}
      </Field.Label>
      <span className={row}>
        <Input
          className={pathInput}
          name="workspace"
          value={workspace}
          onChange={handleInputChange}
        />
        <Button
          aria-label={folderLabel}
          className={folderButton}
          disabled={disabled || picking}
          onClick={handlePick}
          title={folderLabel}
        >
          <FolderOpen aria-hidden />
          <span className={folderText}>{folderLabel}</span>
        </Button>
      </span>
    </Field.Root>
  );
}
export function RecentWorkspaces({
  disabled,
  items,
  onChange,
  workspace,
}: {
  disabled: boolean;
  items: string[];
  onChange: (workspace: string) => void;
  workspace: string;
}) {
  const { t } = useTranslation("preparation"),
    label = t("recentWorkspaces");
  return items.length > 0 ? (
    <div className={recent}>
      <span className={recentLabel}>{label}</span>
      <ul aria-label={label} className={recentList}>
        {items.map((item) => (
          <li className={recentItem} key={item}>
            <RecentWorkspaceButton
              disabled={disabled}
              item={item}
              selected={item === workspace}
              onChange={onChange}
            />
          </li>
        ))}
      </ul>
    </div>
  ) : null;
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
      visual="ghost"
    >
      {selected ? <Check aria-hidden /> : <History aria-hidden />}
      <span className={recentPath}>{item}</span>
    </Button>
  );
}
