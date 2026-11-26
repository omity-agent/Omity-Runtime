import { openBrowser } from "../app/launch";
import { startAppServer } from "../app/server";
import { appendSessionMessage, setSessionControl } from "../client";
import { runHost } from "../host";
import { localize } from "../i18n/server";
import { deleteStoredSession } from "../storedSessions";
import type { HostMode } from "../types";
import type { CliCommand } from "./parser";

export async function executeCommand(command: CliCommand, root = process.cwd()) {
  switch (command.action) {
    case "app": {
      await startAppServer({
        host: command.host,
        onReady: (url) => {
          console.log(localize("cli:output.webStarted", { url }));
          openBrowser(url);
        },
        port: command.port,
        root,
      });
      return;
    }
    case "delete": {
      deleteStoredSession(command.sessionId);
      console.log(localize("cli:output.sessionDeleted", { sessionId: command.sessionId }));
      return;
    }
    case "new":
    case "load":
    case "overwrite": {
      await runHost(
        {
          kind: command.action,
          profile: "profile" in command ? command.profile : undefined,
          sessionId: command.sessionId,
        } satisfies HostMode,
        root,
      );
      return;
    }
    case "append": {
      const result = appendSessionMessage(command.sessionId, command.message.join(" "));
      console.log(
        localize("cli:output.messageSent", {
          sessionId: command.sessionId,
          inputId: result.inputId.toString(),
        }),
      );
      return;
    }
    case "pause":
    case "resume":
    case "cancel": {
      const control =
        command.action === "resume" ? (command.step ? "step" : "running") : command.action;
      setSessionControl(command.sessionId, control);
      const instruction = control === "step" ? "resume --step" : command.action;
      console.log(
        localize("cli:output.controlSent", {
          instruction,
          sessionId: command.sessionId,
        }),
      );
      return;
    }
  }
}
