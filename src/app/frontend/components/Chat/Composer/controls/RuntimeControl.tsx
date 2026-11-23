import { LoaderCircle, Pause, Play, StepForward } from "lucide-react";
import { useCallback } from "react";
import { css } from "styled-system/css";

import type { Control, SessionStatus } from "../../../../../../types";
import { useTranslation } from "../../../../i18n";
import { reportPromiseErrors } from "../../../../services/errors";
import { IconButton } from "../../../ui";
import { runtimeControls } from "../arrangement";

type RequestedControl = Extract<Control, "running" | "step" | "pause">;
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
  onControl?: (control: RequestedControl) => Promise<void>;
}) {
  const { t } = useTranslation(),
    requestControl = useCallback(
      (control: RequestedControl) => {
        if (onControl) {
          reportPromiseErrors(onControl(control));
        }
      },
      [onControl],
    ),
    pause = useCallback(() => {
      requestControl("pause");
    }, [requestControl]),
    resume = useCallback(() => {
      requestControl("running");
    }, [requestControl]),
    step = useCallback(() => {
      requestControl("step");
    }, [requestControl]),
    controlState = sessionStatus && controlStates[sessionStatus],
    disabled = controlDisabled || sessionStatus === "idle",
    controlLabel = controlState ? t(`conversation:${controlState}`) : "",
    resumeLabel = t("conversation:resumeContinuous"),
    stepLabel = t("conversation:step"),
    cancelPauseLabel = t("conversation:cancelPause"),
    control =
      controlState === "resume" || controlState === "stepping" ? (
        <>
          <IconButton
            aria-label={resumeLabel}
            disabled={disabled}
            onClick={resume}
            title={resumeLabel}
            type="button"
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
            >
              <StepForward
                className={controlState === "stepping" ? activeIcon : undefined}
                size={16}
              />
            </IconButton>
          ) : null}
        </>
      ) : controlState ? (
        <IconButton
          aria-label={controlState === "pausing" ? cancelPauseLabel : controlLabel}
          disabled={disabled}
          onClick={controlState === "pause" ? pause : resume}
          title={controlState === "pausing" ? cancelPauseLabel : controlLabel}
          type="button"
        >
          {controlState === "pausing" ? (
            <LoaderCircle className={activeIcon} size={16} />
          ) : (
            <Pause size={16} />
          )}
        </IconButton>
      ) : null;
  return (
    <fieldset aria-label={controlLabel} className={runtimeControls}>
      {control}
    </fieldset>
  );
}
