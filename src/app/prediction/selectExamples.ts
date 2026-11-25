import { uniqBy } from "es-toolkit";

import type { Settings } from "../../types";
import type { loadPredictionSnapshot } from "./samples";

export type PredictionSettings = Extract<NonNullable<Settings["prediction"]>, { enabled: true }>;
export class PredictionExamples {
  private selectedIds: string[] = [];
  select(snapshot: ReturnType<typeof loadPredictionSnapshot>, config: PredictionSettings) {
    const eligible = uniqBy(
      snapshot.samples
        .filter(
          ({ contextTokens, userTokens }) =>
            contextTokens > config.sampleContextTokens && userTokens <= config.maxUserMessageTokens,
        )
        .toSorted(
          (left, right) => right.createdAt - left.createdAt || right.id.localeCompare(left.id),
        ),
      (sample) => sample.assistant,
    );
    if (eligible.length < config.sampleCount) {
      return undefined;
    }
    const latest = eligible.slice(0, config.sampleCount).toReversed(),
      cutoff = Math.floor(Date.now() / 1000) - config.refreshIntervalHours * 3600;
    if (
      this.selectedIds.length === config.sampleCount &&
      latest.some(({ id }) => this.selectedIds.includes(id)) &&
      snapshot.sessionUpdates.some((updatedAt) => updatedAt >= cutoff)
    ) {
      const byId = new Map(eligible.map((sample) => [sample.id, sample] as const)),
        retained = this.selectedIds.map((id) => byId.get(id));
      if (retained.every((sample) => sample !== undefined)) {
        return retained;
      }
    }
    this.selectedIds = latest.map(({ id }) => id);
    return latest;
  }
}
