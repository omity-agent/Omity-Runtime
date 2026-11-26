import { KeyRound, LogOut } from "lucide-react";
import { createContext, useContext } from "react";
import { useTranslation } from "react-i18next";

import type { AccessStatus } from "../../services/access";
import { Button, LinkButton } from "../ui";

export const AccessNavigationContext = createContext<
  | {
      busy: boolean;
      handleLogout: () => Promise<void>;
      status: AccessStatus;
    }
  | undefined
>(undefined);
export function CredentialAction() {
  const { t } = useTranslation("credentials"),
    access = useContext(AccessNavigationContext);
  if (!access || (access.status.local && !access.status.configured)) {
    return null;
  }
  return access.status.local ? (
    <LinkButton
      aria-label={t("manageCredentials")}
      href="?setup=manage#/new"
      iconOnly
      title={t("manageCredentials")}
      visual="ghost"
    >
      <KeyRound aria-hidden size={16} />
    </LinkButton>
  ) : (
    <Button
      aria-label={t("logout")}
      disabled={access.busy}
      iconOnly
      onClick={access.handleLogout}
      title={t("logout")}
      type="button"
      visual="ghost"
    >
      <LogOut aria-hidden size={16} />
    </Button>
  );
}
