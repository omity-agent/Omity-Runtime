import { KeyRound, ShieldCheck } from "lucide-react";
import { useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import { css } from "styled-system/css";

import type { AccessStatus } from "../../services/access";
import { Button, Code, LinkButton } from "../ui";

const page = css({
    alignItems: "center",
    background: "bg.canvas",
    color: "fg.default",
    display: "grid",
    fontFamily: "body",
    minHeight: "viewport",
    overflowY: "auto",
    padding: { _short: "3", base: "4", sm: "6" },
  }),
  card = css({
    background: "bg.default",
    borderColor: "border.emphasized",
    borderWidth: "hairline",
    display: "grid",
    gap: "5",
    justifySelf: "center",
    maxWidth: "accessCard",
    padding: { _short: "5", base: "5", sm: "8" },
    width: "full",
  }),
  icon = css({ color: "fg.muted" }),
  heading = css({ textStyle: "accessHeading" }),
  description = css({ color: "fg.muted", lineHeight: "markdown" }),
  errorText = css({ color: "status.error", fontSize: "editor" }),
  action = css({ flexGrow: { base: 1, sm: 0 } }),
  actions = css({
    display: "flex",
    flexWrap: "wrap",
    gap: "3",
  }),
  setupLinkComponents = { code: <Code /> };
interface AccessPageProps {
  busy: boolean;
  error?: string;
  status?: AccessStatus;
  ticketUrl?: string;
  onLogin: () => void;
  onRegister: () => void;
  onTicket: () => void;
  onContinue: () => void;
  setup: boolean;
}
export function AccessPage(props: AccessPageProps) {
  const { t } = useTranslation("credentials"),
    { busy, error, status, ticketUrl, onContinue, onLogin, onRegister, onTicket, setup } = props,
    ticketValues = useMemo(() => (ticketUrl ? { url: ticketUrl } : undefined), [ticketUrl]),
    localSetup =
      setup &&
      status?.local === true &&
      globalThis.location.origin !== status.publicOrigin &&
      [null, "manage"].includes(new URLSearchParams(globalThis.location.search).get("setup")),
    setupLink =
      ticketUrl ??
      (status?.publicOrigin
        ? new URL(globalThis.location.pathname, status.publicOrigin).href
        : undefined);
  return (
    <main className={page}>
      <section className={card}>
        {setup ? (
          <ShieldCheck className={icon} size={28} />
        ) : (
          <KeyRound className={icon} size={28} />
        )}
        <h1 className={heading}>{t(setup ? "setupTitle" : "loginTitle")}</h1>
        <p className={description}>{t(setup ? "setupDescription" : "loginDescription")}</p>
        {status && !status.configured && <p className={errorText}>{t("notConfigured")}</p>}
        {ticketValues && (
          <p className={description}>
            <Trans
              components={setupLinkComponents}
              i18nKey="setupLink"
              t={t}
              values={ticketValues}
            />
          </p>
        )}
        {error && <p className={errorText}>{error}</p>}
        <div className={actions}>
          {setup ? (
            <>
              {localSetup && (
                <Button
                  className={action}
                  disabled={busy || !status.configured}
                  onClick={onTicket}
                  type="button"
                >
                  {t("createSetupLink")}
                </Button>
              )}
              {localSetup && setupLink && (
                <LinkButton className={action} href={setupLink}>
                  {t(ticketUrl ? "openSetupLink" : "openPublicOrigin")}
                </LinkButton>
              )}
              {!localSetup && (
                <Button className={action} disabled={busy} onClick={onRegister} type="button">
                  {t("register")}
                </Button>
              )}
              {localSetup && (
                <Button
                  className={action}
                  disabled={busy}
                  onClick={onContinue}
                  type="button"
                  visual="ghost"
                >
                  {t("continueLocal")}
                </Button>
              )}
            </>
          ) : (
            <Button
              className={action}
              disabled={busy || !status?.configured}
              onClick={onLogin}
              type="button"
            >
              {t("verify")}
            </Button>
          )}
        </div>
      </section>
    </main>
  );
}
