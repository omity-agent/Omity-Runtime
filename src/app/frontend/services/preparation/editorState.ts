import { useEffect, useRef, useState } from "react";

import { claimShortId } from "../../../../infrastructure/randomId";
import { type AttachmentSettings, initialAttachmentTexts } from "../../../attachments/contract";
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
function draftEditor(draft: SessionPreparation) {
  return {
    draft,
    pendingPairId: claimShortId((candidate) => !draft.pairs.some(({ id }) => id === candidate)),
  };
}
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
  const [editor, setEditor] = useState(() => draftEditor(emptyPreparation())),
    { draft } = editor,
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0),
    editorRef = useRef(editor),
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
      editorRef.current = draftEditor(loaded.draft);
      revisionRef.current = loaded.revision;
      setEditor(editorRef.current);
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
      if (
        !flushComposerDraft(target, JSON.stringify(editorRef.current.draft), revisionRef.current)
      ) {
        reportError(new Error(localize("diagnostics:newSession.draftSaveFailed")));
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
  const update = (change: DraftUpdate, append = false) => {
      if (revisionRef.current >= Number.MAX_SAFE_INTEGER) {
        throw new Error(localize("diagnostics:newSession.draftRevisionUnsafe"));
      }
      const current = editorRef.current.draft,
        next = {
          ...current,
          workspace: current.workspace ?? defaultWorkspace,
          ...(typeof change === "function" ? change(current) : change),
        };
      editorRef.current = append ? draftEditor(next) : { ...editorRef.current, draft: next };
      revisionRef.current += 1;
      retainPreparation(next, revisionRef.current);
      setEditor(editorRef.current);
      setRevision(revisionRef.current);
      saverRef.current?.schedule(JSON.stringify(next), revisionRef.current);
    },
    updateMessage = (message: string) => {
      if (message !== editorRef.current.draft.message) {
        update({ message });
      }
    },
    changePair = (id: string, next: Partial<InitialMessagePair>) => {
      update(({ pairs }) => ({
        pairs: pairs.map((item) => (item.id === id ? { ...item, ...next } : item)),
      }));
    },
    removePair = (id: string) => {
      update(({ pairs }) => ({ pairs: pairs.filter((item) => item.id !== id) }));
    },
    appendPair = (user: string) => {
      const { draft: current, pendingPairId: id } = editorRef.current,
        pair: EditablePair = { assistant: "", id, user };
      update({ message: "", pairs: [...current.pairs, pair] }, true);
    },
    pasteFiles = (files: File[]) => {
      const { pairs, message } = editorRef.current.draft,
        texts = initialAttachmentTexts(pairs, message),
        placeholders = attachmentsRef.current.paste(files, texts);
      if (placeholders) {
        filesPendingRef.current = retainFiles(
          attachmentsRef.current.values([...texts, placeholders]),
        );
        reportPromiseErrors(filesPendingRef.current);
      }
      return placeholders;
    },
    flush = async () => {
      if (revisionRef.current > 0) {
        saverRef.current?.schedule(JSON.stringify(editorRef.current.draft), revisionRef.current);
      }
      await Promise.all([saverRef.current?.flush(), filesPendingRef.current]);
    },
    clear = async (submittedRevision: number) => {
      if (revisionRef.current !== submittedRevision) {
        return;
      }
      saverRef.current?.discardPending();
      editorRef.current = draftEditor(emptyPreparation(editorRef.current.draft));
      retainPreparation(editorRef.current.draft, revisionRef.current);
      setEditor(editorRef.current);
      attachmentsRef.current.clear();
      await retainFiles([]);
    };
  return {
    appendPair,
    attachmentsRef,
    changePair,
    clear,
    draft,
    flush,
    loading,
    pasteFiles,
    pendingPairId: editor.pendingPairId,
    removePair,
    revision,
    update,
    updateMessage,
    workspace: draft.workspace ?? defaultWorkspace,
  };
}
