import { LoaderCircle, Pause, Play, StepForward } from "lucide-react";
import { type MouseEvent, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { css } from "styled-system/css";

import type { PlaybackControl, SessionStatus } from "../../../../../../types";
import { reportPromiseErrors } from "../../../../services/errors";
import { IconButton } from "../../../ui";
import { runtimeControls } from "../arrangement";

const activeIcon = css({ animationStyle: "activity" }),
  controlStates = {
    error: "resume",
    idle: "resume",
    paused: "resume",
    pausing: "pausing",
    stepping: "stepping",
    streaming: "pause",
    tool: "pause",
    waiting: "pause",
  } as const satisfies Record<SessionStatus, string>;
export function RuntimeControl({
  controlDisabled,
  sessionStatus,
  stepAvailable = false,
  onControl,
}: {
  controlDisabled: boolean;
  sessionStatus?: SessionStatus;
  stepAvailable?: boolean;
  onControl?: (control: PlaybackControl) => Promise<void>;
}) {
  const { t } = useTranslation("conversation"),
    requestControl = useCallback(
      (control: PlaybackControl) => {
        if (onControl) {
          reportPromiseErrors(onControl(control));
        }
      },
      [onControl],
    ),
    controlState = sessionStatus && controlStates[sessionStatus],
    pausing = controlState === "pausing",
    pause = useCallback(
      (event: MouseEvent<HTMLButtonElement>) => {
        requestControl(event.ctrlKey ? "force_pause" : pausing ? "running" : "pause");
      },
      [pausing, requestControl],
    ),
    resume = useCallback(() => {
      requestControl("running");
    }, [requestControl]),
    step = useCallback(() => {
      requestControl("step");
    }, [requestControl]),
    disabled = controlDisabled || sessionStatus === "idle",
    controlLabel = controlState ? t(controlState) : "",
    resumeLabel = t("resumeContinuous"),
    stepLabel = t("step"),
    pauseLabel = t(pausing ? "cancelPause" : "pause"),
    canPause = controlState === "pause" || pausing || controlState === "stepping";
  return (
    <fieldset aria-label={controlLabel} className={runtimeControls}>
      {controlState === "resume" || controlState === "stepping" ? (
        <>
          <IconButton
            aria-label={resumeLabel}
            disabled={disabled}
            onClick={resume}
            title={resumeLabel}
            type="button"
            visual="ghost"
          >
            <Play size={16} />
          </IconButton>
          {stepAvailable || controlState === "stepping" ? (
            <IconButton
              aria-label={controlState === "stepping" ? controlLabel : stepLabel}
              disabled={disabled || controlState === "stepping"}
              onClick={step}
              title={controlState === "stepping" ? controlLabel : stepLabel}
              type="button"
              visual="ghost"
            >
              <StepForward
                className={controlState === "stepping" ? activeIcon : undefined}
                size={16}
              />
            </IconButton>
          ) : null}
        </>
      ) : null}
      {canPause ? (
        <IconButton
          aria-label={pauseLabel}
          disabled={disabled}
          onClick={pause}
          title={pauseLabel}
          type="button"
          visual="ghost"
        >
          {pausing ? <LoaderCircle className={activeIcon} size={16} /> : <Pause size={16} />}
        </IconButton>
      ) : null}
    </fieldset>
  );
}
