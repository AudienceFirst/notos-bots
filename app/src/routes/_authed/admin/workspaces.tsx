import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
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
  addWorkspaceMemberMutationOptions,
  adminWorkspacesQueryOptions,
  MEMBER_ROLE_LABELS,
  MODEL_CHOICES,
  removeWorkspaceMemberMutationOptions,
  setWorkspaceDriveMutationOptions,
  setWorkspaceModelMutationOptions,
  type WorkspaceMember,
  workspaceMembersQueryOptions,
} from "@/lib/workspaces/queries";
import { queryClient } from "@/query-client";

export const Route = createFileRoute("/_authed/admin/workspaces")({
  component: WorkspacesPage,
});

function WorkspacesPage() {
  const workspaces = useQuery(adminWorkspacesQueryOptions());
  const setModel = useMutation(setWorkspaceModelMutationOptions(queryClient));
  const setDrive = useMutation(setWorkspaceDriveMutationOptions(queryClient));
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
                    <DriveFolderField
                      disabled={setDrive.isPending}
                      roots={workspace.driveRoots ?? []}
                      onSave={(folders) =>
                        setDrive.mutate({ id: workspace.id, folders })
                      }
                    />
                    <MembersField workspaceId={workspace.id} />
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

/**
 * NOTOS (stap 8): the client's Drive folder(s), as links or ids, one per line or comma separated.
 * Saved as a whole: an empty box means no folder, and the Bots then say so instead of searching
 * all of Drive.
 */
function DriveFolderField({
  roots,
  disabled,
  onSave,
}: {
  roots: string[];
  disabled: boolean;
  onSave: (folders: string[]) => void;
}) {
  const [value, setValue] = useState(roots.join("\n"));
  const [editing, setEditing] = useState(false);
  if (!editing) {
    return (
      <button
        className="text-muted-foreground text-xs underline-offset-2 hover:underline"
        onClick={() => setEditing(true)}
        type="button"
      >
        {roots.length === 0
          ? "No Drive folder"
          : `Drive: ${roots.length} folder${roots.length === 1 ? "" : "s"}`}
      </button>
    );
  }
  return (
    <form
      className="flex flex-col gap-1"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(
          value
            .split(/[\n,]/)
            .map((item) => item.trim())
            .filter(Boolean),
        );
        setEditing(false);
      }}
    >
      <textarea
        aria-label="Drive folder links"
        className="w-64 rounded-md border bg-transparent px-2 py-1 font-mono text-xs"
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
        placeholder="https://drive.google.com/drive/folders/…"
        rows={2}
        value={value}
      />
      <div className="flex gap-2">
        <Button disabled={disabled} size="sm" type="submit">
          Save
        </Button>
        <Button
          onClick={() => {
            setValue(roots.join("\n"));
            setEditing(false);
          }}
          size="sm"
          type="button"
          variant="ghost"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

/**
 * NOTOS (5 September 2026): who is in this workspace on top of what NOTOS says. NOTOS stays the
 * source for client logins; this is the Bots-side roster an administrator keeps by hand, with a
 * role that decides what the person may approve.
 */
function MembersField({ workspaceId }: { workspaceId: string }) {
  const members = useQuery(workspaceMembersQueryOptions(workspaceId));
  const add = useMutation(addWorkspaceMemberMutationOptions(queryClient));
  const remove = useMutation(removeWorkspaceMemberMutationOptions(queryClient));
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceMember["role"]>("specialist");
  const rows = members.data ?? [];

  return (
    <div className="mt-2 w-full">
      <button
        className="text-muted-foreground text-xs hover:text-foreground"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        {open ? "Hide members" : `Members (${rows.length})`}
      </button>
      {open ? (
        <div className="mt-2 flex flex-col gap-2">
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              Nobody added here yet. People NOTOS already lets in keep their
              access.
            </p>
          ) : null}
          {rows.map((member) => (
            <div className="flex items-center gap-2 text-sm" key={member.email}>
              <span className="truncate">{member.email}</span>
              <span className="text-muted-foreground text-xs">
                {MEMBER_ROLE_LABELS[member.role]}
              </span>
              <Button
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate({ id: workspaceId, email: member.email })
                }
                size="sm"
                variant="ghost"
              >
                Remove
              </Button>
            </div>
          ))}
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!email.trim()) return;
              add.mutate(
                { id: workspaceId, email: email.trim(), role },
                { onSuccess: () => setEmail("") },
              );
            }}
          >
            <Input
              className="h-8 text-sm"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.com"
              type="email"
              value={email}
            />
            <select
              className="h-8 rounded-md border border-border bg-background px-2 text-sm"
              onChange={(event) =>
                setRole(event.target.value as WorkspaceMember["role"])
              }
              value={role}
            >
              {(
                Object.keys(MEMBER_ROLE_LABELS) as WorkspaceMember["role"][]
              ).map((option) => (
                <option key={option} value={option}>
                  {MEMBER_ROLE_LABELS[option]}
                </option>
              ))}
            </select>
            <Button disabled={add.isPending} size="sm" type="submit">
              Add
            </Button>
          </form>
          {add.error ? (
            <p className="text-destructive text-xs" role="alert">
              {add.error.message}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
