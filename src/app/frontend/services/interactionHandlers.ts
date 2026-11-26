import type { QueryClient } from "@tanstack/react-query";

import { isRunningStatus, type PlaybackControl } from "../../../types";
import type { SessionInfo } from "../../sessionState";
import { setControl, setSessionProfile } from "./client";
import { reportError } from "./errors";
import { updateSession } from "./queries";

export function createProfileChangeHandler(options: {
  activeSession?: SessionInfo;
  pendingFork: boolean;
  profileChangePending: boolean;
  queryClient: QueryClient;
  setProfileChangePending: (pending: boolean) => void;
}) {
  return async (profile?: string) => {
    if (
      !options.activeSession ||
      options.pendingFork ||
      options.profileChangePending ||
      isRunningStatus(options.activeSession.status)
    ) {
      return;
    }
    options.setProfileChangePending(true);
    try {
      const result = await setSessionProfile(options.activeSession.id, profile);
      updateSession(options.queryClient, result.session);
    } catch (error) {
      reportError(error);
    } finally {
      options.setProfileChangePending(false);
    }
  };
}
export function createControlChangeHandler(options: {
  activeSessionId?: string;
  controlPendingFork: (control: PlaybackControl) => Promise<void>;
  pendingFork: boolean;
}) {
  return async (control: PlaybackControl) => {
    if (options.pendingFork) {
      await options.controlPendingFork(control);
      return;
    }
    if (options.activeSessionId) {
      await setControl(options.activeSessionId, control);
    }
  };
}
