import { KeyRound, LogOut } from "lucide-react";
import { createContext, useContext } from "react";
import { useTranslation } from "react-i18next";
import { css } from "styled-system/css";

import type { AccessStatus } from "../../services/access";
import { Button, LinkButton } from "../ParkUI";

const footer = css({
    borderBlockStartWidth: "hairline",
    borderTopColor: "line",
    padding: "2",
  }),
  action = css({
    color: "mutedStrong",
    height: "controlTarget",
    width: "controlTarget",
  });
export const AccessNavigationContext = createContext<
  | {
      busy: boolean;
      handleLogout: () => Promise<void>;
      status: AccessStatus;
    }
  | undefined
>(undefined);
export function NavigationActions() {
  const { t } = useTranslation(),
    access = useContext(AccessNavigationContext);
  if (!access || (access.status.local && !access.status.configured)) {
    return null;
  }
  return (
    <footer className={footer}>
      {access.status.local ? (
        <LinkButton
          aria-label={t("accessManageCredentials")}
          className={action}
          href="?setup=manage#/new"
          iconOnly
          title={t("accessManageCredentials")}
          variant="ghost"
        >
          <KeyRound aria-hidden size={14} />
        </LinkButton>
      ) : (
        <Button
          aria-label={t("accessLogout")}
          className={action}
          disabled={access.busy}
          iconOnly
          onClick={access.handleLogout}
          title={t("accessLogout")}
          type="button"
          variant="ghost"
        >
          <LogOut aria-hidden size={14} />
        </Button>
      )}
    </footer>
  );
}
