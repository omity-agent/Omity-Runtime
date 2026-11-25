import { Send } from "lucide-react";
import { css } from "styled-system/css";

import { IconButton } from "../../../ui";

export function SubmitButton({ disabled, label }: { disabled: boolean; label: string }) {
  return (
    <IconButton
      aria-label={label}
      className={css({ borderRadius: "md" })}
      disabled={disabled}
      title={label}
      type="submit"
      visual={disabled ? "outline" : "solid"}
    >
      <Send aria-hidden size={16} />
    </IconButton>
  );
}
