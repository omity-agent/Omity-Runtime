import { Send } from "lucide-react";

import { IconButton } from "../../../ui";

export function SubmitButton({ disabled, label }: { disabled: boolean; label: string }) {
  return (
    <IconButton
      aria-label={label}
      disabled={disabled}
      title={label}
      type="submit"
      visual={disabled ? "outline" : "solid"}
    >
      <Send aria-hidden size={16} />
    </IconButton>
  );
}
