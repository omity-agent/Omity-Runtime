import { z } from "zod";

export const promptSelectionSchema = z.strictObject({
  disabledPrompts: z.array(z.string().min(1)),
  enabledSkills: z.array(z.string().min(1)),
});
export type PromptSelection = z.infer<typeof promptSelectionSchema>;

export function changePromptSelection(
  selection: PromptSelection | undefined,
  key: keyof PromptSelection,
  id: string,
  selected: boolean,
): PromptSelection {
  const current = selection ?? { disabledPrompts: [], enabledSkills: [] },
    ids = new Set(current[key]);
  if (selected) {
    ids.add(id);
  } else {
    ids.delete(id);
  }
  return { ...current, [key]: [...ids] };
}
