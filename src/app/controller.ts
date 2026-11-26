import { setSessionControl } from "../client";
import { sessionProfileBusy } from "../failures/rejections";
import type { FileLinkAction } from "../fileLinks/types";
import type { SettingsContext } from "../infrastructure/configuration/settings/context";
import { readComposerDraftRecord } from "../infrastructure/database/records/session/composerDrafts";
import { appOwner } from "../infrastructure/process/ownership";
import { AskUserRuntime } from "../infrastructure/toolbox/runtime";
import { deleteStoredSession, requestHostToolCancellation } from "../storedSessions";
import { type ControlCommand, isRunningStatus, type Settings } from "../types";
import type { MessageSubmission, SessionSubmission } from "./attachments/contract";
import { enqueueMessageWithAttachments } from "./attachments/message";
import { writeSessionDraft } from "./composition/draftStorage";
import { AppEvents } from "./events";
import { activateFileLink } from "./fileLinks/launch";
import { controllerSessionInfo, createControllerHosts } from "./hostCoordination";
import type { AppHosts } from "./hosts";
import type { PredictionService } from "./prediction/service";
import { createSessionPredictions } from "./prediction/settingsSource";
import type { AppRegistry, RegisteredSession } from "./registry";
import { availableSessionOptions } from "./runtime/availableOptions";
import {
  bootstrapPayload,
  type ControllerOptions,
  prepareController,
} from "./runtime/prepareController";
import { hasLiveHostLease } from "./runtime/recovery";
import { storeSessionProfile } from "./runtime/sessions/profileChange";
import { materializeAppFork, provisionAppSession } from "./runtime/sessions/provision";
import { closeControllerResources } from "./runtime/shutdown";
import { clearAgentTemporaryFiles } from "./runtime/temporaryFiles";
import { loadTranscript } from "./transcript";

export class AppController {
  readonly events = new AppEvents();
  private readonly settings: Settings;
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
    this.askUser = new AskUserRuntime((sessionId) => this.publishChange(sessionId));
    this.prediction = createSessionPredictions(this.registry, this.settingsContext);
    this.hosts = createControllerHosts({
      askUser: this.askUser,
      changed: (id) => this.publishChange(id),
      context: this.settingsContext,
      events: this.events,
      owner: options.owner ?? appOwner(),
      prediction: (sessionId) => {
        void this.prediction.onIdle(sessionId);
      },
      root: appRoot,
      sessionInfo: (id) => this.sessionInfo(this.registry.require(id)),
      settings: this.settings,
    });
  }
  close = () => closeControllerResources(this.hosts, this.registry, this.prediction);
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
      storeSessionProfile(this.appRoot, this.settingsContext, session, profile);
      this.hosts.clearError(sessionId);
    });
    return this.notifySession(this.registry.refresh(sessionId));
  }
  async predictions(sessionId: string) {
    this.registry.require(sessionId);
    return { predictions: await this.prediction.get(sessionId) };
  }
  assertSession(sessionId: string) {
    this.registry.require(sessionId);
  }
  async activateFileLink(sessionId: string, path: string, action: FileLinkAction) {
    this.registry.require(sessionId);
    return { path: await activateFileLink(path, action) };
  }
  async createSession(submission: SessionSubmission) {
    const { sessionId, workspace } = await provisionAppSession({
        baseContext: this.settingsContext,
        mcp: this.hosts.mcp,
        root: this.appRoot,
        submission,
      }),
      session = this.registry.refresh(sessionId);
    this.hosts.scheduleStart(sessionId, workspace);
    return this.notifySession(session);
  }
  async sendMessage(sessionId: string, submission: MessageSubmission) {
    const session = this.registry.require(sessionId),
      result = await enqueueMessageWithAttachments(
        this.settings.attachments,
        sessionId,
        submission,
        () => this.ensureHost(session),
      );
    this.hosts.clearError(sessionId);
    this.publishChange(sessionId);
    return result;
  }
  composerDraft(sessionId: string) {
    return this.registry.read(sessionId, (db) => readComposerDraftRecord(db, sessionId));
  }
  saveComposerDraft(sessionId: string, content: string, revision: number) {
    this.registry.require(sessionId);
    return writeSessionDraft(sessionId, content, revision);
  }
  async control(sessionId: string, control: ControlCommand) {
    const session = this.registry.require(sessionId);
    if (control === "running" || control === "step") {
      await this.ensureHost(session);
    }
    const result = setSessionControl(sessionId, control);
    this.publishChange(sessionId);
    return result;
  }
  cancelTool(sessionId: string, toolCallId: string) {
    this.registry.require(sessionId);
    requestHostToolCancellation(sessionId, toolCallId);
    this.hosts.cancelTool(sessionId, toolCallId);
    this.publishChange(sessionId);
    return { toolCallId };
  }
  answerTool(sessionId: string, toolCallId: string, answer: unknown) {
    this.registry.require(sessionId);
    return this.askUser.answer(sessionId, toolCallId, answer);
  }
  async materializeFork(sessionId: string, beforeMessageId: number) {
    const session = this.registry.require(sessionId),
      id = await materializeAppFork({
        beforeMessageId,
        pauseSource: () => this.control(sessionId, "pause"),
        profiles: session.profiles,
        sourceSessionId: sessionId,
        workspace: session.workspace,
      });
    this.hosts.clearError(id);
    return this.notifySession(this.registry.refresh(id));
  }
  async deleteSession(sessionId: string) {
    this.registry.require(sessionId);
    await this.hosts.stop(sessionId);
    deleteStoredSession(sessionId);
    this.hosts.clearError(sessionId);
    this.registry.remove(sessionId);
    this.events.notifyDeleted(sessionId);
    return { deleted: sessionId };
  }
  clearTemporaryFiles(sessionId: string) {
    this.registry.require(sessionId);
    return clearAgentTemporaryFiles(sessionId);
  }
  transcript(sessionId: string) {
    return this.registry.read(sessionId, (db) => loadTranscript(db, sessionId));
  }
  eventCursor(sessionId: string) {
    return this.registry.eventCursor(sessionId);
  }
  private ensureHost(session: RegisteredSession) {
    if (!this.hosts.has(session.id) && hasLiveHostLease(session.id)) {
      return Promise.resolve();
    }
    return this.hosts.ensure(session.id, session.workspace);
  }
  private publishChange(sessionId: string) {
    this.events.wake(sessionId);
    this.notifySession(this.registry.refresh(sessionId));
    this.events.invalidateTranscript(sessionId, this.eventCursor(sessionId));
  }
  private notifySession(session: RegisteredSession) {
    const info = this.sessionInfo(session);
    this.events.notifySession(info);
    return info;
  }
  private sessionInfo(session: RegisteredSession) {
    return controllerSessionInfo(session, this.hosts, this.askUser);
  }
}
