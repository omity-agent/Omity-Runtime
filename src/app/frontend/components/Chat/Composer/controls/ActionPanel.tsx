import type { ReactNode } from "react";

import { useTranslation } from "../../../../i18n";
import { composerActions, composerControls } from "../arrangement";

export function ActionPanel({ children, footer }: { children?: ReactNode; footer?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className={composerActions}>
      {footer}
      {children ? (
        <fieldset aria-label={t("conversation:composerActions")} className={composerControls}>
          {children}
        </fieldset>
      ) : null}
    </div>
  );
}
