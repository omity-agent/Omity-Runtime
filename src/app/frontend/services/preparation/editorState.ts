import { useEffect, useRef, useState } from "react";

import { claimShortId } from "../../../../infrastructure/randomId";
import type { AttachmentSettings } from "../../../attachments/contract";
import {
  type EditablePair,
  emptyPreparation,
  type SessionPreparation,
} from "../../../composition/preparation";
import type { InitialMessagePair } from "../../../initialState";
import { PendingAttachments } from "../../components/Chat/Composer/attachments";
import { localize } from "../../i18n";
import { flushComposerDraft } from "../composerDrafts";
import { reportError, reportPromiseErrors } from "../errors";
import { DraftSaver } from "../scheduling/draftSaver";
import { restorePreparation, retainFiles, retainPreparation } from "./browserSnapshot";

const target = { kind: "new" } as const;
type DraftUpdate =
  Partial<SessionPreparation> | ((current: SessionPreparation) => Partial<SessionPreparation>);
export function useNewSessionDraft({
  attachmentSettings,
  defaultWorkspace,
  enabled,
  saveDelayMs,
}: {
  attachmentSettings?: AttachmentSettings;
  defaultWorkspace: string;
  enabled: boolean;
  saveDelayMs?: number;
}) {
  "use no memo";
  const [draft, setDraft] = useState(emptyPreparation),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0),
    draftRef = useRef(draft),
    revisionRef = useRef(0),
    saverRef = useRef<DraftSaver | undefined>(undefined),
    attachmentsRef = useRef(new PendingAttachments()),
    filesPendingRef = useRef(Promise.resolve());
  useEffect(() => {
    attachmentsRef.current.configure(attachmentSettings);
  }, [attachmentSettings]);
  useEffect(() => {
    let current = true;
    const load = async () => {
      const loaded = await restorePreparation();
      if (!current) {
        return;
      }
      attachmentsRef.current.restore(loaded.attachments);
      draftRef.current = loaded.draft;
      revisionRef.current = loaded.revision;
      setDraft(loaded.draft);
      setRevision(loaded.revision);
      setLoading(false);
      if (loaded.revision > 0) {
        saverRef.current?.schedule(JSON.stringify(loaded.draft), loaded.revision);
      }
    };
    if (enabled) {
      reportPromiseErrors(load());
    }
    return () => {
      current = false;
    };
  }, [enabled]);
  useEffect(() => {
    const saver = new DraftSaver(target, saveDelayMs ?? 0, reportError);
    saverRef.current = saver;
    return () => {
      if (saverRef.current === saver) {
        saverRef.current = undefined;
      }
      reportPromiseErrors(saver.flush());
    };
  }, [saveDelayMs]);
  useEffect(() => {
    const flush = () => {
      if (revisionRef.current === 0) {
        return;
      }
      if (!flushComposerDraft(target, JSON.stringify(draftRef.current), revisionRef.current)) {
        reportError(new Error(localize("frontend:newSession.draftSaveFailed")));
      }
    };
    window.addEventListener("pagehide", flush);
    const visibility = () => {
      if (document.visibilityState === "hidden") {
        flush();
      }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  const update = (change: DraftUpdate) => {
      if (revisionRef.current >= Number.MAX_SAFE_INTEGER) {
        throw new Error(localize("frontend:newSession.draftRevisionUnsafe"));
      }
      const next = {
        ...draftRef.current,
        workspace: draftRef.current.workspace ?? defaultWorkspace,
        ...(typeof change === "function" ? change(draftRef.current) : change),
      };
      draftRef.current = next;
      revisionRef.current += 1;
      retainPreparation(next, revisionRef.current);
      setDraft(next);
      setRevision(revisionRef.current);
      saverRef.current?.schedule(JSON.stringify(next), revisionRef.current);
    },
    updateMessage = (message: string) => {
      if (message !== draftRef.current.message) {
        update({ message });
      }
    },
    changePair = (id: string, next: InitialMessagePair) => {
      update({
        pairs: draftRef.current.pairs.map((item) => (item.id === id ? { ...next, id } : item)),
      });
    },
    removePair = (id: string) => {
      update({
        pairs: draftRef.current.pairs.filter((item) => item.id !== id),
      });
    },
    addPair = () => {
      const { current } = draftRef,
        id = claimShortId((candidate) => !current.pairs.some((item) => item.id === candidate)),
        pair: EditablePair = { assistant: "", id, user: "" };
      update({ pairs: [...current.pairs, pair] });
    },
    pasteFiles = (files: File[]) => {
      const placeholders = attachmentsRef.current.paste(files, draftRef.current.message);
      if (placeholders) {
        filesPendingRef.current = retainFiles(
          attachmentsRef.current.values(`${draftRef.current.message}\n${placeholders}`),
        );
        reportPromiseErrors(filesPendingRef.current);
      }
      return placeholders;
    },
    flush = async () => {
      if (revisionRef.current > 0) {
        saverRef.current?.schedule(JSON.stringify(draftRef.current), revisionRef.current);
      }
      await Promise.all([saverRef.current?.flush(), filesPendingRef.current]);
    },
    clear = async (submittedRevision: number) => {
      if (revisionRef.current !== submittedRevision) {
        return;
      }
      saverRef.current?.discardPending();
      draftRef.current = emptyPreparation(draftRef.current);
      retainPreparation(draftRef.current, revisionRef.current);
      setDraft(draftRef.current);
      attachmentsRef.current.clear();
      await retainFiles([]);
    };
  return {
    addPair,
    attachmentsRef,
    changePair,
    clear,
    draft,
    flush,
    loading,
    pasteFiles,
    removePair,
    revision,
    update,
    updateMessage,
    workspace: draft.workspace ?? defaultWorkspace,
  };
}
