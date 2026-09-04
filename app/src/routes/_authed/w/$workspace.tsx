// NOTOS: de workspace-laag van de URL, /w/:workspace/... (bouwplan stap 2).
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { currentUserQueryOptions } from "@/lib/auth/queries";
import { currentWorkspace, setCurrentWorkspace } from "@/notos/workspace";

// De query-sleutels die bij een workspace horen; zie de `all`-sleutels in de queries-bestanden onder src/lib.
const WORKSPACE_OWNED = new Set([
  "agents",
  "channels",
  "routines",
  "components",
  "sandboxed",
  "computers",
]);

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
    const previous = currentWorkspace();
    setCurrentWorkspace(params.workspace);
    /*
     * Een andere workspace is een andere wereld: de cache van bots, kanalen, routines, skills en
     * componenten is per workspace, maar de sleutels zeggen dat niet. Weggooien dus, anders toont het
     * scherm nog even de bots van de vorige klant onder de naam van de nieuwe.
     */
    if (previous !== null && previous !== params.workspace) {
      context.queryClient.removeQueries({
        predicate: (query) =>
          WORKSPACE_OWNED.has(String(query.queryKey[0] ?? "")),
      });
    }
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
