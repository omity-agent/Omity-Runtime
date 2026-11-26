import { type Context, Hono } from "hono";
import { compress } from "hono/compress";

import { localize } from "../../i18n/server";
import type { Settings } from "../../types";
import type { AccessService } from "../access/service";
import {
  answerToolBody,
  cancelToolBody,
  composerDraftBody,
  controlBody,
  fileLinkActionBody,
  forkMaterializationBody,
  preparationDraftBody,
  profileBody,
  reasoningTranslationBody,
} from "../contracts/commands";
import type { AppController } from "../controller";
import { transcriptHistoryHeader } from "../timeline/contracts/records";
import { pickWorkspaceDirectory } from "../workspaceDialog/bridge";
import { type AccessEnvironment, mountAccess } from "./access";
import { errorResponse, HttpError } from "./errors";
import { messageForm, sessionForm } from "./multipart";
import { decodeSessionId, limitRequestBody, requestValidation, validate } from "./request";

export function createApi(
  controller: AppController,
  settings: Pick<Settings, "attachments" | "server">,
  access?: AccessService,
) {
  const app = new Hono<AccessEnvironment>(),
    { maxSizeBytes: attachmentBytes } = settings.attachments,
    { requestBodyLimitBytes: bodyBytes } = settings.server,
    validation = requestValidation(bodyBytes),
    { json: jsonBody } = validation,
    attachmentRequestLimit = limitRequestBody(bodyBytes + attachmentBytes, "attachment"),
    routes = mountAccess(app, access, validation);
  app.use("/api/sessions/:sessionId/messages", attachmentRequestLimit);
  app.use("/api/sessions/:sessionId/transcript", compress());
  app.notFound((c) => {
    throw new HttpError(404, localize("http:request.apiUnknown", { path: c.req.path }));
  });
  app.onError(handleApiError);
  return routes
    .get("/api/bootstrap", (c) => c.json(controller.bootstrap()))
    .get("/api/user-messages", (c) => c.json({ messages: controller.views.userMessages.read() }))
    .get("/api/session-preparation", (c) => c.json(controller.drafts.preparation()))
    .on(["PUT", "POST"], "/api/session-preparation", ...jsonBody(preparationDraftBody), (c) => {
      const body = c.req.valid("json");
      return c.json(controller.drafts.savePreparation(body.content, body.revision));
    })
    .get("/api/session-options", validate("query", profileBody), (c) =>
      c.json(controller.sessionOptions(c.req.valid("query").profile)),
    )
    .get("/api/sessions", (c) => c.json({ sessions: controller.sessions() }))
    .get("/api/events/state", (c) => controller.events.streamState(c, () => controller.sessions()))
    .post("/api/workspace-picker", async (c) =>
      c.json({ workspace: await pickWorkspaceDirectory() }),
    )
    .post("/api/sessions", attachmentRequestLimit, sessionForm, async (c) =>
      c.json({
        session: await controller.createSession(c.req.valid("form")),
      }),
    )
    .delete("/api/sessions/:sessionId", async (c) => {
      const deletedSessionId = decodeSessionId(c.req.param("sessionId"));
      return c.json(await controller.deleteSession(deletedSessionId));
    })
    .put("/api/sessions/:sessionId/profile", ...jsonBody(profileBody), async (c) => {
      const body = c.req.valid("json");
      return c.json({
        session: await controller.updateProfile(sessionId(c), body.profile),
      });
    })
    .delete("/api/sessions/:sessionId/temporary-files", async (c) =>
      c.json(await controller.clearTemporaryFiles(sessionId(c))),
    )
    .get("/api/sessions/:sessionId/transcript", (c) => {
      c.header("Cache-Control", "no-store");
      return c.json(
        controller.views.transcript.read(sessionId(c), c.req.header(transcriptHistoryHeader)),
      );
    })
    .get("/api/sessions/:sessionId/predictions", async (c) =>
      c.json(await controller.predictions(sessionId(c))),
    )
    .post(
      "/api/sessions/:sessionId/file-links/activate",
      ...jsonBody(fileLinkActionBody),
      async (c) => {
        const body = c.req.valid("json");
        return c.json(await controller.activateFileLink(sessionId(c), body.path, body.action));
      },
    )
    .get("/api/sessions/:sessionId/events/content", (c) => {
      const id = sessionId(c);
      return controller.events.streamContent(c, id, controller.views.transcript.syncPoint(id));
    })
    .get("/api/sessions/:sessionId/composer-draft", (c) =>
      c.json(controller.drafts.session(sessionId(c))),
    )
    .on(
      ["PUT", "POST"],
      "/api/sessions/:sessionId/composer-draft",
      ...jsonBody(composerDraftBody),
      (c) => {
        const body = c.req.valid("json");
        return c.json(controller.drafts.saveSession(sessionId(c), body.content, body.revision));
      },
    )
    .put(
      "/api/sessions/:sessionId/reasoning-translation",
      ...jsonBody(reasoningTranslationBody),
      (c) => {
        return c.json(controller.views.saveTranslation(sessionId(c), c.req.valid("json")));
      },
    )
    .post("/api/sessions/:sessionId/messages", messageForm, async (c) =>
      c.json(await controller.sendMessage(sessionId(c), c.req.valid("form"))),
    )
    .post("/api/sessions/:sessionId/control", ...jsonBody(controlBody), async (c) => {
      const body = c.req.valid("json");
      return c.json(await controller.control(sessionId(c), body.control));
    })
    .post("/api/sessions/:sessionId/tools/cancel", ...jsonBody(cancelToolBody), (c) => {
      const body = c.req.valid("json");
      return c.json(controller.cancelTool(sessionId(c), body.toolCallId));
    })
    .post("/api/sessions/:sessionId/tools/answer", ...jsonBody(answerToolBody), (c) => {
      const body = c.req.valid("json");
      return c.json(controller.answerTool(sessionId(c), body.toolCallId, body.answer));
    })
    .post(
      "/api/sessions/:sessionId/fork/materialize",
      ...jsonBody(forkMaterializationBody),
      async (c) => {
        const body = c.req.valid("json");
        return c.json({
          session: await controller.materializeFork(sessionId(c), body.beforeMessageId),
        });
      },
    );
}
function handleApiError(error: Error, c: Context) {
  const normalized = errorResponse(error);
  return c.json(normalized.body, normalized.status);
}
function sessionId(c: Context) {
  const value = c.req.param("sessionId");
  if (value === undefined) {
    throw new HttpError(400, localize("http:request.sessionIdMissing"));
  }
  return decodeSessionId(value);
}
