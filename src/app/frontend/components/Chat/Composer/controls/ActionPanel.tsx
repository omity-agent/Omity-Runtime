import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { composerActions, composerControls } from "../arrangement";

export function ActionPanel({ children, footer }: { children?: ReactNode; footer?: ReactNode }) {
  const { t } = useTranslation("conversation");
  return (
    <div className={composerActions}>
      {footer}
      {children ? (
        <fieldset aria-label={t("composerActions")} className={composerControls}>
          {children}
        </fieldset>
      ) : null}
    </div>
  );
}
