// NOTOS: de wortel stuurt door naar de eerste workspace van deze persoon (bouwplan stap 2).
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useT } from "@/i18n";
import { currentUserQueryOptions } from "@/lib/auth/queries";

export const Route = createFileRoute("/_authed/")({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(
      currentUserQueryOptions(),
    );
    const first = user?.workspaces[0];
    if (first) {
      throw redirect({
        to: "/w/$workspace",
        params: { workspace: first.notosClientId },
      });
    }
  },
  component: NoWorkspace,
});

function NoWorkspace() {
  const t = useT();
  return (
    <div className="flex h-dvh w-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
      {t("settings.home.noWorkspace")}
    </div>
  );
}
