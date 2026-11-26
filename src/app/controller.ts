import { once } from "es-toolkit";

import { sessionProfileBusy } from "../failures/rejections";
import type { FileLinkAction } from "../fileLinks/types";
import type { SettingsContext } from "../infrastructure/configuration/settings/context";
import type { AgentDatabase } from "../infrastructure/database/agentDatabase";
import { requestControlRecord } from "../infrastructure/database/records/execution/control";
import { AskUserRuntime } from "../infrastructure/toolbox/runtime";
import { type AppSettings, type ControlCommand, isRunningStatus } from "../types";
import type { MessageSubmission, SessionSubmission } from "./attachments/contract";
import { enqueueMessageWithAttachments } from "./attachments/message";
import { DraftStorage } from "./composition/draftStorage";
import { AppEvents } from "./events";
import { activateFileLink } from "./fileLinks/launch";
import { controllerSessionInfo, createControllerHosts } from "./hostCoordination";
import type { AppHosts } from "./hosts";
import { ObservedSessions } from "./observedSessions";
import type { PredictionService } from "./prediction/service";
import { createSessionPredictions } from "./prediction/settingsSource";
import type { AppRegistry, RegisteredSession } from "./registry";
import { availableSessionOptions } from "./runtime/availableOptions";
import {
  bootstrapPayload,
  type ControllerOptions,
  prepareController,
} from "./runtime/prepareController";
import { deleteStoredSession } from "./runtime/sessions/persistence";
import { storeSessionProfile } from "./runtime/sessions/profileChange";
import { materializeAppFork, provisionAppSession } from "./runtime/sessions/provision";
import { closeControllerResources } from "./runtime/shutdown";
import { clearAgentTemporaryFiles } from "./runtime/temporaryFiles";

export class AppController {
  readonly events = new AppEvents();
  readonly database: AgentDatabase;
  readonly drafts: DraftStorage;
  readonly views: ObservedSessions;
  private readonly settings: AppSettings;
  private readonly registry: AppRegistry;
  private readonly hosts: AppHosts;
  private readonly askUser: AskUserRuntime;
  private readonly prediction: PredictionService;
  private readonly settingsContext: SettingsContext;
  constructor(
    private readonly appRoot: string,
    options: ControllerOptions = {},
  ) {
    const prepared = prepareController(appRoot, options);
    this.settingsContext = prepared.settingsContext;
    this.settings = prepared.settings;
    this.registry = prepared.registry;
    this.database = prepared.database;
    this.drafts = new DraftStorage(this.registry);
    this.views = new ObservedSessions(this.database, this.registry, this.events, (session) =>
      this.sessionInfo(session),
    );
    this.askUser = new AskUserRuntime((id) => this.views.publishActivity(id));
    this.prediction = createSessionPredictions(this.registry, this.settingsContext);
    this.hosts = createControllerHosts({
      askUser: this.askUser,
      changed: (id) => this.views.refresh(id),
      context: this.settingsContext,
      database: this.database,
      events: this.events,
      prediction: (sessionId) => {
        void this.prediction.onIdle(sessionId);
      },
      root: appRoot,
      sessionInfo: (id) => this.sessionInfo(this.registry.require(id)),
      settings: this.settings,
    });
  }
  close = once(() => closeControllerResources(this.prediction, this.hosts, this.database));
  bootstrap() {
    return bootstrapPayload(this.appRoot, this.settings, this.settingsContext, this.sessions());
  }
  sessions() {
    return this.registry.list().map((session) => this.sessionInfo(session));
  }
  sessionOptions = (profile?: string) => availableSessionOptions(this.settingsContext, profile);
  async updateProfile(sessionId: string, profile?: string) {
    const session = this.registry.require(sessionId);
    if (isRunningStatus(this.sessionInfo(session).status)) {
      throw sessionProfileBusy(sessionId);
    }
    await this.hosts.withStoppedHost(sessionId, session.workspace, () => {
      storeSessionProfile(this.database.db, this.appRoot, this.settingsContext, session, profile);
      this.hosts.clearError(sessionId);
      this.views.transcript.forgetHistory(sessionId);
    });
    return this.views.refresh(sessionId);
  }
  async predictions(sessionId: string) {
    this.registry.require(sessionId);
    return { predictions: await this.prediction.get(sessionId) };
  }
  async activateFileLink(sessionId: string, path: string, action: FileLinkAction) {
    this.registry.require(sessionId);
    return { path: await activateFileLink(path, action) };
  }
  async createSession(submission: SessionSubmission) {
    const { sessionId, workspace } = await provisionAppSession({
      baseContext: this.settingsContext,
      database: this.database,
      mcp: this.hosts.mcp,
      root: this.appRoot,
      submission,
    });
    const info = this.views.add(sessionId, submission.history.length > 0);
    this.hosts.scheduleStart(sessionId, workspace);
    return info;
  }
  async sendMessage(sessionId: string, submission: MessageSubmission) {
    const session = this.registry.require(sessionId),
      result = await enqueueMessageWithAttachments(
        this.settings.attachments,
        sessionId,
        submission,
        async (content, revision, submissionId) => {
          await this.hosts.ensure(sessionId, session.workspace);
          const inputId = this.database.submitUser(sessionId, content, revision, submissionId);
          this.hosts.notify(sessionId);
          return inputId;
        },
      );
    this.hosts.clearError(sessionId);
    this.views.refresh(sessionId);
    return result;
  }
  async control(sessionId: string, control: ControlCommand) {
    const session = this.registry.require(sessionId);
    if (control === "running" || control === "step") {
      await this.hosts.ensure(sessionId, session.workspace);
    }
    requestControlRecord(this.database.db, sessionId, control);
    if (control === "cancel" && !this.hosts.has(sessionId)) {
      this.database.recoverInterruptedSession(sessionId);
    }
    this.hosts.notify(sessionId, control);
    this.views.refresh(sessionId);
    return { control };
  }
  cancelTool(sessionId: string, toolCallId: string) {
    this.registry.require(sessionId);
    const requestedAt = this.database.requestToolCancellation(sessionId, toolCallId);
    this.hosts.cancelTool(sessionId, toolCallId, requestedAt);
    this.views.refresh(sessionId);
    return { toolCallId };
  }
  answerTool(sessionId: string, toolCallId: string, answer: unknown) {
    this.registry.require(sessionId);
    return this.askUser.answer(sessionId, toolCallId, answer);
  }
  async materializeFork(sessionId: string, beforeMessageId: number) {
    const session = this.registry.require(sessionId),
      id = await materializeAppFork(this.database, {
        beforeMessageId,
        pauseSource: () => this.control(sessionId, "pause"),
        profiles: session.profiles,
        sourceSessionId: sessionId,
        workspace: session.workspace,
      });
    this.hosts.clearError(id);
    return this.views.add(id, true);
  }
  async deleteSession(sessionId: string) {
    this.registry.require(sessionId);
    return this.hosts.withStoppedHost(sessionId, undefined, () => {
      try {
        deleteStoredSession(this.database, sessionId);
      } finally {
        if (!this.database.hasSession(sessionId)) {
          this.hosts.clearError(sessionId);
          this.views.remove(sessionId);
        }
      }
      return { deleted: sessionId };
    });
  }
  clearTemporaryFiles(sessionId: string) {
    this.registry.require(sessionId);
    return clearAgentTemporaryFiles(sessionId);
  }
  transcript(sessionId: string) {
    return this.views.transcript.read(sessionId);
  }
  private sessionInfo(session: RegisteredSession) {
    return controllerSessionInfo(session, this.hosts, this.askUser);
  }
}
