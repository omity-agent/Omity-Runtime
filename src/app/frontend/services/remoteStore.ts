import { QueryCache, QueryClient } from "@tanstack/react-query";

import { uiBehavior } from "../presentation/preferences";
import { reportError } from "./errors";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: uiBehavior.queryRetries.mutations },
      queries: { retry: uiBehavior.queryRetries.queries },
    },
    queryCache: new QueryCache({
      onError: (error, query) => {
        reportError(error, { queryKey: query.queryKey });
      },
    }),
  });
}
