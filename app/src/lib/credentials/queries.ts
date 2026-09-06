import { queryOptions } from "@tanstack/react-query";
import { client } from "@/lib/client";
import { tr } from "@/i18n";

export type CredentialStatus = {
  id: string;
  kind: "model" | "connector";
  provider: string;
  keyId: string;
  metadata: Record<string, unknown>;
  revokedAt: string | null;
};

export const credentialKeys = {
  all: ["credentials"] as const,
  list: () => [...credentialKeys.all, "list"] as const,
};

export function credentialListQueryOptions() {
  return queryOptions({
    queryKey: credentialKeys.list(),
    queryFn: async (): Promise<CredentialStatus[]> => {
      return client("/api/admin/credentials", "credentials", {
        fallback: tr("lib.credentials.loadFailed"),
      });
    },
  });
}
