import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import {
  type ComposerDraftTarget,
  flushComposerDraft,
  readComposerDraft,
  writeComposerDraft,
} from "../../../../services/composerDrafts";
import { reportError, reportPromiseErrors } from "../../../../services/errors";
import { DraftSaver } from "../../../../services/scheduling/draftSaver";

export function useComposerDraft({
  draft,
  draftSaveDelayMs,
  draftTarget,
}: {
  draft?: string;
  draftSaveDelayMs?: number;
  draftTarget: ComposerDraftTarget;
}) {
  const [target] = useReducer((value: ComposerDraftTarget) => value, draftTarget),
    [content, setContent] = useState(draft ?? ""),
    [loading, setLoading] = useState(true),
    contentRef = useRef(content),
    revisionRef = useRef(0),
    saverRef = useRef<DraftSaver | undefined>(undefined);
  useEffect(() => {
    let current = true;
    const load = async () => {
      const loaded = await readComposerDraft(target, draft ?? "");
      if (current) {
        revisionRef.current = loaded.revision;
        contentRef.current = loaded.content;
        setContent(loaded.content);
        setLoading(false);
      }
    };
    reportPromiseErrors(load());
    return () => {
      current = false;
    };
  }, [draft, target]);
  useEffect(() => {
    if (draftSaveDelayMs === undefined) {
      return;
    }
    const saver = new DraftSaver(target, draftSaveDelayMs, reportError);
    saverRef.current = saver;
    return () => {
      if (saverRef.current === saver) {
        saverRef.current = undefined;
      }
      reportPromiseErrors(saver.flush());
    };
  }, [draftSaveDelayMs, target]);
  useEffect(() => {
    const flush = () => {
      flushComposerDraft(target, contentRef.current, revisionRef.current);
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
    };
  }, [target]);
  const flush = useCallback(async () => {
      await saverRef.current?.flush();
      if (target.kind !== "session") {
        await writeComposerDraft(target, contentRef.current, revisionRef.current);
      }
    }, [target]),
    change = (nextContent: string) => {
      if (nextContent !== contentRef.current) {
        contentRef.current = nextContent;
        setContent(nextContent);
        revisionRef.current += 1;
        saverRef.current?.schedule(nextContent, revisionRef.current);
      }
    };
  return {
    change,
    content,
    contentRef,
    flush,
    loading,
    revisionRef,
    saverRef,
    setContent,
    target,
  };
}
