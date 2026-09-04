// NOTOS: per workspace het model en waar het draait (bouwplan stap 3).
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  PageEmpty,
  PageRows,
  PageSection,
  PageShell,
} from "@/components/layout/page-shell";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import {
  adminWorkspacesQueryOptions,
  MODEL_CHOICES,
  setWorkspaceModelMutationOptions,
} from "@/lib/workspaces/queries";
import { queryClient } from "@/query-client";

export const Route = createFileRoute("/_authed/admin/workspaces")({
  component: WorkspacesPage,
});

function WorkspacesPage() {
  const workspaces = useQuery(adminWorkspacesQueryOptions());
  const setModel = useMutation(setWorkspaceModelMutationOptions(queryClient));
  const rows = workspaces.data?.workspaces ?? null;
  const problem = workspaces.error
    ? "The workspaces could not be loaded."
    : setModel.error
      ? setModel.error.message
      : null;

  return (
    <PageShell
      description="Every NOTOS client is a workspace. The model stays in the EU by default; global is a deliberate choice per workspace, because that traffic leaves the EU."
      title="Workspaces"
    >
      {problem ? <p className="text-sm text-destructive">{problem}</p> : null}
      <PageSection>
        {rows === null ? (
          <PageEmpty>Laden…</PageEmpty>
        ) : rows.length === 0 ? (
          <PageEmpty>
            Nog geen workspaces: de sync met NOTOS heeft nog niets opgehaald.
          </PageEmpty>
        ) : (
          <PageRows>
            {rows.map((workspace) => {
              const chosen = MODEL_CHOICES.find(
                (choice) =>
                  choice.vertexLocation === workspace.vertexLocation &&
                  choice.defaultModel === workspace.defaultModel,
              );
              return (
                <Item key={workspace.id}>
                  <ItemContent>
                    <ItemTitle>
                      {workspace.displayName}
                      {workspace.kind === "demo" ? " (demo)" : ""}
                    </ItemTitle>
                    <ItemDescription>
                      {workspace.notosClientId}
                      {!chosen
                        ? ` · ${workspace.defaultModel} on ${workspace.vertexLocation} (own setting)`
                        : ""}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <select
                      aria-label={`Model for ${workspace.displayName}`}
                      className="text-sm bg-transparent border rounded-md px-2 py-1"
                      disabled={setModel.isPending}
                      value={
                        chosen
                          ? `${chosen.vertexLocation}|${chosen.defaultModel}`
                          : ""
                      }
                      onChange={(event) => {
                        const [vertexLocation, defaultModel] =
                          event.target.value.split("|");
                        if (!vertexLocation || !defaultModel) return;
                        setModel.mutate({
                          id: workspace.id,
                          vertexLocation,
                          defaultModel,
                        });
                      }}
                    >
                      {!chosen ? <option value="">Own setting</option> : null}
                      {MODEL_CHOICES.map((choice) => (
                        <option
                          key={choice.defaultModel}
                          value={`${choice.vertexLocation}|${choice.defaultModel}`}
                        >
                          {choice.label}
                        </option>
                      ))}
                    </select>
                  </ItemActions>
                </Item>
              );
            })}
          </PageRows>
        )}
      </PageSection>
    </PageShell>
  );
}
