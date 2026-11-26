import { BookOpen, Webhook, Wrench } from "lucide-react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { css } from "styled-system/css";

import { reportPromiseErrors } from "../../../services/errors";
import { Button } from "../../ui";
import { setupControl, setupSurface, wrappingRow } from "../setupLayout";
import type { useSessionPreferences } from "./preferences";
import { SettingsCard } from "./SettingsCard";

const panelsLayout = css(wrappingRow, { gap: { base: "2", md: "4" } }),
  notice = css(setupSurface, {
    alignItems: "center",
    color: "fg.muted",
    display: "flex",
    flexWrap: "wrap",
    fontSize: "interface",
    gap: "3",
    justifyContent: "space-between",
    overflowWrap: "anywhere",
    padding: "4",
  }),
  retry = css(setupControl, { _hover: { background: "bg.emphasized" } });

export function CapabilityPanels({
  disabled,
  selection,
}: {
  disabled: boolean;
  selection: ReturnType<typeof useSessionPreferences>;
}) {
  const { t } = useTranslation(["preparation", "conversation"]),
    handleRetry = useCallback(() => reportPromiseErrors(selection.reload()), [selection]);
  if (selection.error) {
    return (
      <div className={notice} role="alert">
        <p>{t("optionsLoadFailed", { message: selection.error.message })}</p>
        <Button className={retry} disabled={disabled} onClick={handleRetry}>
          {t("retry")}
        </Button>
      </div>
    );
  }
  if (!selection.ready) {
    return <output className={notice}>{t("loadingOptions")}</output>;
  }
  const panels = [
    {
      emptyLabel: t("noHooks"),
      icon: Webhook,
      label: t("hooks"),
      sections: [{ onChange: selection.handleHookChange, options: selection.hooks }],
    },
    {
      emptyLabel: t("noTools"),
      icon: Wrench,
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
      emptyLabel: t("noPrompts"),
      icon: BookOpen,
      label: t("prompts"),
      sections: [
        {
          label: t("promptFiles"),
          onChange: selection.handlePromptChange,
          options: selection.prompts,
        },
        {
          hideDescriptions: true,
          label: t("skills"),
          onChange: selection.handleSkillChange,
          options: selection.skills,
        },
      ],
    },
  ];
  return (
    <div className={panelsLayout}>
      {panels.map((panel) => (
        <SettingsCard disabled={disabled} key={panel.label} {...panel} />
      ))}
    </div>
  );
}
