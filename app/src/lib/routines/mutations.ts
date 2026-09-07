import { mutationOptions, type QueryClient } from "@tanstack/react-query";
import { tr } from "@/i18n";
import { client } from "@/lib/client";
import { routineKeys } from "./queries";

/**
 * Writes against a person's own standing instructions.
 *
 * THERE IS NO CREATE AND NO EDIT HERE, on purpose: this page only shows and stops. Making a routine
 * and changing one are conversational, through the `RoutineTools` a Bot calls mid-chat — see
 * `server/src/routines/routes.ts` for the full reasoning.
 */

const failed = () => tr("lib.routines.changeFailed");

function invalidateRoutines(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: routineKeys.all });
}

/** Switch one routine on or off. Immediate; there is no save. */
export function setRoutineEnabledMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: (variables: { id: string; enabled: boolean }) =>
      client(`/api/routines/${encodeURIComponent(variables.id)}/enabled`, {
        method: "PUT",
        body: { enabled: variables.enabled },
        fallback: failed(),
      }),
    onSuccess: () => invalidateRoutines(queryClient),
  });
}

export function deleteRoutineMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: (id: string) =>
      client(`/api/routines/${encodeURIComponent(id)}`, {
        method: "DELETE",
        fallback: failed(),
      }),
    onSuccess: () => invalidateRoutines(queryClient),
  });
}

/** NOTOS (stap 9): a routine from the page. The server validates the schedule and the channel. */
export function createRoutineMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: async (input: {
      agentId: string;
      channelId?: string;
      instruction: string;
      cron: string;
      timezone: string;
      /** `schedule` (op de klok), `mention` of `keyword`. */
      trigger?: string;
      keyword?: string;
    }) => {
      await client("/api/routines", {
        method: "POST",
        body: input,
        fallback: tr("lib.routines.createFailed"),
      });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: routineKeys.all }),
  });
}
