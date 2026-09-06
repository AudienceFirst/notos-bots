// NOTOS: campagnes als ruimtes in een workspace (Mitch, 5 september 2026).
import {
  mutationOptions,
  type QueryClient,
  queryOptions,
} from "@tanstack/react-query";
import { client } from "@/lib/client";
import { tr } from "@/i18n";

export type Campaign = {
  id: string;
  workspaceId: string;
  slug: string;
  name: string;
  brief: string;
  status: "active" | "archived";
  createdBy: string | null;
  createdAt: string;
  archivedAt: string | null;
};

export const campaignKeys = {
  all: ["campaigns"] as const,
  list: (archived: boolean) => ["campaigns", "list", archived] as const,
};

export function campaignListQueryOptions(archived = false) {
  return queryOptions({
    queryKey: campaignKeys.list(archived),
    queryFn: async (): Promise<Campaign[]> => {
      const response = await client(
        `/api/campaigns${archived ? "?archived=1" : ""}`,
        { fallback: tr("lib.campaigns.loadFailed") },
      );
      return ((await response.json()) as { campaigns: Campaign[] }).campaigns;
    },
  });
}

export function createCampaignMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: async (input: { name: string; brief?: string }) => {
      const response = await client("/api/campaigns", {
        method: "POST",
        body: input,
        fallback: tr("lib.campaigns.createFailed"),
      });
      return ((await response.json()) as { campaign: Campaign }).campaign;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: campaignKeys.all }),
  });
}

export function updateCampaignMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: async (input: {
      id: string;
      name?: string;
      brief?: string;
      status?: "active" | "archived";
    }) => {
      const { id, ...patch } = input;
      const response = await client(
        `/api/campaigns/${encodeURIComponent(id)}`,
        {
          method: "PUT",
          body: patch,
          fallback: tr("lib.campaigns.changeFailed"),
        },
      );
      return ((await response.json()) as { campaign: Campaign }).campaign;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: campaignKeys.all }),
  });
}
