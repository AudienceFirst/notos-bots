// NOTOS: de workspace-laag van de URL, /w/:workspace/... (bouwplan stap 2).
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { currentUserQueryOptions } from "@/lib/auth/queries";
import { setCurrentWorkspace } from "@/notos/workspace";

export const Route = createFileRoute("/_authed/w/$workspace")({
  beforeLoad: async ({ context, params }) => {
    const user = await context.queryClient.ensureQueryData(
      currentUserQueryOptions(),
    );
    const allowed = user?.workspaces.find(
      (workspace) => workspace.notosClientId === params.workspace,
    );
    // Een workspace die niet van deze persoon is bestaat voor hem niet: terug naar de eerste die wel is.
    if (!allowed) {
      throw redirect({ to: "/" });
    }
    // Vóór de eerste query van een kindroute, zodat elke API-aanroep al onder /api/w/<slug>/ gaat.
    setCurrentWorkspace(params.workspace);
    return { workspace: allowed };
  },
  component: WorkspaceLayout,
});

function WorkspaceLayout() {
  const { workspace } = Route.useParams();
  useEffect(() => {
    setCurrentWorkspace(workspace);
    return () => setCurrentWorkspace(null);
  }, [workspace]);
  return <Outlet />;
}
