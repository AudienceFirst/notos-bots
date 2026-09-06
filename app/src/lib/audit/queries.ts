import { queryOptions } from "@tanstack/react-query";
import { client } from "@/lib/client";
import { tr } from "@/i18n";

export const auditKeys = { all: ["audit-events"] as const };

export function auditEventsQueryOptions(search = "") {
  return queryOptions({
    queryKey: [...auditKeys.all, search] as const,
    queryFn: async () => {
      const response = await client(`/api/admin/audit-events${search}`, {
        fallback: tr("lib.audit.loadFailed"),
      });
      return response.json();
    },
  });
}
