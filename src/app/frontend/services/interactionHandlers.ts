import type { QueryClient } from "@tanstack/react-query";

import { type Control, isRunningStatus, type SessionStatus } from "../../../types";
import type { SessionInfo } from "../../sessionState";
import { setControl, setSessionProfile } from "./client";
import { reportError } from "./errors";
import { updateSession } from "./queries";

export function createProfileChangeHandler(options: {
  activeSession?: SessionInfo;
  pendingFork: boolean;
  profileChangePending: boolean;
  queryClient: QueryClient;
  sessionStatus?: SessionStatus;
  setProfileChangePending: (pending: boolean) => void;
}) {
  return async (profile?: string) => {
    if (
      !options.activeSession ||
      options.pendingFork ||
      options.profileChangePending ||
      isRunningStatus(options.sessionStatus)
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
  controlPendingFork: (control: Extract<Control, "running" | "step" | "pause">) => Promise<void>;
  pendingFork: boolean;
  setPausingSessionId: (sessionId?: string) => void;
}) {
  return async (control: Extract<Control, "running" | "step" | "pause">) => {
    if (options.pendingFork) {
      await options.controlPendingFork(control);
      return;
    }
    if (!options.activeSessionId) {
      return;
    }
    if (control === "pause") {
      options.setPausingSessionId(options.activeSessionId);
    }
    try {
      await setControl(options.activeSessionId, control);
    } catch (error) {
      if (control === "pause") {
        options.setPausingSessionId(undefined);
      }
      throw error;
    }
    if (control !== "pause") {
      options.setPausingSessionId(undefined);
    }
  };
}
