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
  /** NOTOS (stap 8): the client's Drive folder ids. */
  driveRoots: string[];
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

/** NOTOS (stap 8): the client's Drive folder(s), as links or ids; an empty list clears them. */
export function setWorkspaceDriveMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: async (input: { id: string; folders: string[] }) => {
      await client(
        `/api/admin/workspaces/${encodeURIComponent(input.id)}/drive`,
        {
          method: "PUT",
          body: { folders: input.folders },
          fallback: "Could not change the Drive folder",
        },
      );
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all }),
  });
}

/** NOTOS (5 September 2026): who is in a workspace on top of what NOTOS says, set by an administrator. */
export type WorkspaceMember = {
  workspaceId: string;
  email: string;
  role: "zuid" | "lead" | "specialist" | "viewer";
  addedBy: string | null;
  createdAt: string;
};

export const MEMBER_ROLE_LABELS: Record<WorkspaceMember["role"], string> = {
  zuid: "ZUID (manages, approves)",
  lead: "Lead (approves)",
  specialist: "Specialist",
  viewer: "Viewer",
};

export const memberKeys = {
  of: (workspaceId: string) =>
    ["admin", "workspaces", workspaceId, "members"] as const,
};

export function workspaceMembersQueryOptions(workspaceId: string) {
  return queryOptions({
    queryKey: memberKeys.of(workspaceId),
    queryFn: async (): Promise<WorkspaceMember[]> =>
      (
        (await (
          await client(
            `/api/admin/workspaces/${encodeURIComponent(workspaceId)}/members`,
            { fallback: "Could not load the members" },
          )
        ).json()) as { members: WorkspaceMember[] }
      ).members,
  });
}

export function addWorkspaceMemberMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: async (input: {
      id: string;
      email: string;
      role: WorkspaceMember["role"];
    }) => {
      await client(
        `/api/admin/workspaces/${encodeURIComponent(input.id)}/members`,
        {
          method: "POST",
          body: { email: input.email, role: input.role },
          fallback: "Could not add that person",
        },
      );
    },
    onSuccess: (_result, input) =>
      queryClient.invalidateQueries({ queryKey: memberKeys.of(input.id) }),
  });
}

export function removeWorkspaceMemberMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: async (input: { id: string; email: string }) => {
      await client(
        `/api/admin/workspaces/${encodeURIComponent(input.id)}/members/${encodeURIComponent(input.email)}`,
        { method: "DELETE", fallback: "Could not remove that person" },
      );
    },
    onSuccess: (_result, input) =>
      queryClient.invalidateQueries({ queryKey: memberKeys.of(input.id) }),
  });
}
