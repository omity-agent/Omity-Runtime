import { z } from "zod";

import { serverI18n } from "../../i18n/server";
import { createPreparationParser } from "./preparation";

const t = serverI18n.getFixedT(null, "drafts");
export const parsePreparation = createPreparationParser(t),
  preparationContentSchema = z.string().superRefine((content, context) => {
    try {
      parsePreparation(content);
    } catch (error) {
      context.addIssue({
        code: "custom",
        message: t("invalidDraft", {
          message: error instanceof Error ? error.message : String(error),
        }),
      });
    }
  });
