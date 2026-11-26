import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { reportPromiseErrors } from "../../../services/errors";
import { Button } from "../../ui";
import { configuration, configurationRow } from "../preparationGrid";
import { ProfilePicker } from "../ProfilePicker";
import { CapabilityPanel } from "./CapabilityPanel";
import { ModelInput } from "./ModelInput";
import type { useSessionPreferences } from "./preferences";

export function ConfigurationPanel({
  availableProfiles,
  disabled,
  onProfileChange,
  selectedProfile,
  selection,
}: {
  availableProfiles: string[];
  disabled: boolean;
  onProfileChange: (profile?: string) => void;
  selectedProfile?: string;
  selection: ReturnType<typeof useSessionPreferences>;
}) {
  const { t } = useTranslation(["preparation", "conversation"]),
    handleRetry = useCallback(() => reportPromiseErrors(selection.reload()), [selection]),
    panels = [
      {
        emptyLabel: t("noHooks"),
        label: t("hooks"),
        sections: [{ onChange: selection.handleHookChange, options: selection.hooks }],
      },
      {
        emptyLabel: t("noTools"),
        label: t("conversation:tool"),
        sections: [
          {
            label: t("builtIn"),
            onChange: selection.handleBuiltInChange,
            options: selection.builtInTools,
          },
          {
            label: t("mcpServers"),
            onChange: selection.handleServerChange,
            options: selection.mcpServers,
          },
        ],
      },
      {
        className: configurationRow,
        emptyLabel: t("noPrompts"),
        guidance: t("promptGuidance"),
        label: t("prompts"),
        sections: [
          {
            label: t("promptFiles"),
            onChange: selection.handlePromptChange,
            options: selection.prompts,
          },
          { label: t("skills"), onChange: selection.handleSkillChange, options: selection.skills },
        ],
        sideBySide: true,
      },
    ];
  return (
    <div className={configuration}>
      <ProfilePicker
        available={availableProfiles}
        disabled={disabled}
        onChange={onProfileChange}
        selected={selectedProfile}
      />
      <ModelInput
        disabled={disabled || !selection.ready}
        model={selection.model}
        onChange={selection.handleModelChange}
      />
      {selection.error ? (
        <div className={configurationRow} role="alert">
          <p>{t("optionsLoadFailed", { message: selection.error.message })}</p>
          <Button disabled={disabled} onClick={handleRetry} type="button">
            {t("retry")}
          </Button>
        </div>
      ) : selection.ready ? (
        panels.map(({ label, ...panel }) => (
          <CapabilityPanel disabled={disabled} key={label} label={label} {...panel} />
        ))
      ) : (
        <output className={configurationRow}>{t("loadingOptions")}</output>
      )}
    </div>
  );
}
