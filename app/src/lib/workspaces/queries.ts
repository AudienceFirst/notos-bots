// NOTOS: workspaces voor het beheerscherm (bouwplan stap 3).
import {
  mutationOptions,
  type QueryClient,
  queryOptions,
} from "@tanstack/react-query";
import { client } from "@/lib/client";

export type AdminWorkspace = {
  id: string;
  notosClientId: string;
  displayName: string;
  kind: string;
  vertexLocation: string;
  defaultModel: string;
};

/** De twee keuzes die deze deployment kent; zie server/src/app.ts. */
export const MODEL_CHOICES = [
  {
    vertexLocation: "europe-west4",
    defaultModel: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro in europe-west4 (stays in the EU)",
  },
  {
    vertexLocation: "global",
    defaultModel: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro Preview on global (leaves the EU)",
  },
] as const;

export const workspaceKeys = {
  all: ["admin", "workspaces"] as const,
};

export function adminWorkspacesQueryOptions() {
  return queryOptions({
    queryKey: workspaceKeys.all,
    queryFn: async () =>
      (await (
        await client("/api/admin/workspaces", {
          fallback: "Could not load workspaces",
        })
      ).json()) as { workspaces: AdminWorkspace[] },
  });
}

export function setWorkspaceModelMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: async (input: {
      id: string;
      vertexLocation: string;
      defaultModel: string;
    }) => {
      await client(
        `/api/admin/workspaces/${encodeURIComponent(input.id)}/model`,
        {
          method: "PUT",
          body: {
            vertexLocation: input.vertexLocation,
            defaultModel: input.defaultModel,
          },
          fallback: "Could not change the model",
        },
      );
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all }),
  });
}
