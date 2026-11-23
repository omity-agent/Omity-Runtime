import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { localize } from "../../i18n";
import {
  type AccessStatus,
  accessStatus,
  login,
  logout,
  register,
  registrationTicket,
} from "../../services/access";
import { reportError } from "../../services/errors";
import { AccessPage } from "./AccessPage";
import { AccessNavigationContext } from "./CredentialAction";

export function AccessGate({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient(),
    [status, setStatus] = useState<AccessStatus>(),
    [busy, setBusy] = useState(true),
    [error, setError] = useState<string>(),
    [continueLocal, setContinueLocal] = useState(false),
    [ticketUrl, setTicketUrl] = useState<string>(),
    setupValue = new URLSearchParams(globalThis.location.search).get("setup") ?? undefined,
    setupTicket = setupValue === "manage" ? undefined : setupValue,
    publicOrigin = status?.publicOrigin,
    load = useCallback(async () => {
      const next = await accessStatus();
      setStatus(next);
    }, [setStatus]);
  useEffect(() => {
    void run(setBusy, setError, load);
  }, [load]);
  useEffect(() => {
    const refresh = () => {
      setStatus(undefined);
      void run(setBusy, setError, load);
    };
    globalThis.addEventListener("omity:auth-required", refresh);
    return () => {
      globalThis.removeEventListener("omity:auth-required", refresh);
    };
  }, [load]);
  const authenticate = useCallback(
      () =>
        run(setBusy, setError, async () => {
          const result = await login();
          if (result.authenticated) {
            await load();
          }
        }),
      [load],
    ),
    enroll = useCallback(
      () =>
        run(setBusy, setError, async () => {
          await register(setupTicket);
          globalThis.history.replaceState(null, "", "./#/new");
          await load();
        }),
      [load, setupTicket],
    ),
    createTicket = useCallback(
      () =>
        run(setBusy, setError, async () => {
          const result = await registrationTicket();
          if (!publicOrigin) {
            throw new Error(localize("credentials:publicOriginMissing"));
          }
          const url = new URL(globalThis.location.pathname, publicOrigin);
          url.searchParams.set("setup", result.ticket);
          setTicketUrl(url.href);
        }),
      [publicOrigin],
    ),
    continueWithoutSetup = useCallback(() => {
      setContinueLocal(true);
    }, []),
    endSession = useCallback(
      () =>
        run(setBusy, setError, async () => {
          await logout();
          queryClient.clear();
          setStatus(await accessStatus());
        }),
      [queryClient, setStatus],
    ),
    setup = setupValue !== undefined || (status?.local === true && status.credentialCount === 0),
    navigation = useMemo(
      () => (status ? { busy, handleLogout: endSession, status } : undefined),
      [busy, endSession, status],
    );
  if (status?.authenticated && (!setup || continueLocal)) {
    return <AccessNavigationContext value={navigation}>{children}</AccessNavigationContext>;
  }
  return (
    <AccessPage
      busy={busy}
      error={error}
      status={status}
      ticketUrl={ticketUrl}
      setup={setup}
      onContinue={continueWithoutSetup}
      onLogin={authenticate}
      onRegister={enroll}
      onTicket={createTicket}
    />
  );
}
async function run(
  setBusy: (value: boolean) => void,
  setError: (value?: string) => void,
  action: () => Promise<unknown>,
) {
  setBusy(true);
  setError(undefined);
  try {
    await action();
  } catch (error: unknown) {
    reportError(error);
    setError(error instanceof Error ? error.message : String(error));
  } finally {
    setBusy(false);
  }
}
