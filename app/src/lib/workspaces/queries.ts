// NOTOS: workspaces voor het beheerscherm (bouwplan stap 3).
import {
  mutationOptions,
  type QueryClient,
  queryOptions,
} from "@tanstack/react-query";
import { client } from "@/lib/client";
import { tr } from "@/i18n";

export type AdminWorkspace = {
  id: string;
  notosClientId: string;
  displayName: string;
  kind: string;
  /** `vertex`, `anthropic`, `openai`, `openrouter` or `google-ai`. */
  modelProvider: string;
  vertexLocation: string;
  defaultModel: string;
  /** NOTOS (stap 8): the client's Drive folder ids. */
  driveRoots: string[];
};

/** De twee keuzes die deze deployment kent; zie server/src/app.ts. */
export const MODEL_CHOICES: readonly {
  provider: "vertex" | "anthropic" | "openai" | "openrouter" | "google-ai";
  vertexLocation: string;
  defaultModel: string;
  label: string;
  /** For a small button: the model name and, for Vertex, where it runs. */
  short: string;
}[] = [
  {
    provider: "vertex",
    vertexLocation: "europe-west4",
    defaultModel: "gemini-2.5-pro",
    get label() {
      return tr("lib.workspaces.gemini25Label");
    },
    get short() {
      return tr("lib.workspaces.gemini25Short");
    },
  },
  {
    provider: "vertex",
    vertexLocation: "global",
    defaultModel: "gemini-3.1-pro-preview",
    get label() {
      return tr("lib.workspaces.gemini31Label");
    },
    get short() {
      return tr("lib.workspaces.gemini31Short");
    },
  },
  // NOTOS (5 September 2026): keyed providers. The key comes from Admin › Models or Settings › Models.
  {
    provider: "anthropic",
    vertexLocation: "-",
    defaultModel: "claude-sonnet-5",
    get label() {
      return tr("lib.workspaces.sonnetLabel");
    },
    get short() {
      return tr("lib.workspaces.sonnetShort");
    },
  },
  {
    provider: "anthropic",
    vertexLocation: "-",
    defaultModel: "claude-opus-5",
    get label() {
      return tr("lib.workspaces.opusLabel");
    },
    get short() {
      return tr("lib.workspaces.opusShort");
    },
  },
  {
    provider: "openai",
    vertexLocation: "-",
    defaultModel: "gpt-5",
    get label() {
      return tr("lib.workspaces.gpt5Label");
    },
    get short() {
      return tr("lib.workspaces.gpt5Short");
    },
  },
  {
    provider: "google-ai",
    vertexLocation: "-",
    defaultModel: "gemini-2.5-pro",
    get label() {
      return tr("lib.workspaces.aiStudioLabel");
    },
    get short() {
      return tr("lib.workspaces.aiStudioShort");
    },
  },
];

export const workspaceKeys = {
  all: ["admin", "workspaces"] as const,
};

export function adminWorkspacesQueryOptions() {
  return queryOptions({
    queryKey: workspaceKeys.all,
    queryFn: async () =>
      (await (
        await client("/api/admin/workspaces", {
          fallback: tr("lib.workspaces.loadFailed"),
        })
      ).json()) as { workspaces: AdminWorkspace[] },
  });
}

export function setWorkspaceModelMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: async (input: {
      id: string;
      provider: string;
      vertexLocation: string;
      defaultModel: string;
    }) => {
      await client(
        `/api/admin/workspaces/${encodeURIComponent(input.id)}/model`,
        {
          method: "PUT",
          body: {
            provider: input.provider,
            vertexLocation: input.vertexLocation,
            defaultModel: input.defaultModel,
          },
          fallback: tr("lib.workspaces.modelChangeFailed"),
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
          fallback: tr("lib.workspaces.driveChangeFailed"),
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

/** Translated at read time, so a label follows the language in force. */
export const MEMBER_ROLE_LABELS: Record<WorkspaceMember["role"], string> = {
  get zuid() {
    return tr("lib.workspaces.roleZuid");
  },
  get lead() {
    return tr("lib.workspaces.roleLead");
  },
  get specialist() {
    return tr("lib.workspaces.roleSpecialist");
  },
  get viewer() {
    return tr("lib.workspaces.roleViewer");
  },
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
            { fallback: tr("lib.workspaces.membersLoadFailed") },
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
          fallback: tr("lib.workspaces.memberAddFailed"),
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
        { method: "DELETE", fallback: tr("lib.workspaces.memberRemoveFailed") },
      );
    },
    onSuccess: (_result, input) =>
      queryClient.invalidateQueries({ queryKey: memberKeys.of(input.id) }),
  });
}
