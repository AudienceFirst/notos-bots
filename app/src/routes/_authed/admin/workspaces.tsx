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
import { useT } from "@/i18n";
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
  const t = useT();
  const workspaces = useQuery(adminWorkspacesQueryOptions());
  const setModel = useMutation(setWorkspaceModelMutationOptions(queryClient));
  const setDrive = useMutation(setWorkspaceDriveMutationOptions(queryClient));
  const rows = workspaces.data?.workspaces ?? null;
  const problem = workspaces.error
    ? t("admin-b.workspaces.loadFailed")
    : setModel.error
      ? setModel.error.message
      : null;

  return (
    <PageShell
      description={t("admin-b.workspaces.description")}
      title={t("admin-b.workspaces.title")}
    >
      {problem ? <p className="text-sm text-destructive">{problem}</p> : null}
      <PageSection>
        {rows === null ? (
          <PageEmpty>{t("admin-b.workspaces.loading")}</PageEmpty>
        ) : rows.length === 0 ? (
          <PageEmpty>{t("admin-b.workspaces.empty")}</PageEmpty>
        ) : (
          <PageRows>
            {rows.map((workspace) => {
              const chosen = MODEL_CHOICES.find(
                (choice) =>
                  choice.provider === workspace.modelProvider &&
                  choice.defaultModel === workspace.defaultModel &&
                  (choice.provider !== "vertex" ||
                    choice.vertexLocation === workspace.vertexLocation),
              );
              return (
                <Item key={workspace.id}>
                  <ItemContent>
                    <ItemTitle>
                      {workspace.displayName}
                      {workspace.kind === "demo"
                        ? ` ${t("admin-b.workspaces.demoSuffix")}`
                        : ""}
                    </ItemTitle>
                    <ItemDescription>
                      {workspace.notosClientId}
                      {!chosen
                        ? ` · ${t("admin-b.workspaces.ownSettingDetail", {
                            model: workspace.defaultModel,
                            where:
                              workspace.modelProvider === "vertex"
                                ? workspace.vertexLocation
                                : workspace.modelProvider,
                          })}`
                        : ""}
                    </ItemDescription>
                  </ItemContent>
                  {/* Stacked: model, Drive folder and members each get a full line of their own. */}
                  <ItemActions className="w-[340px] shrink-0 flex-col items-stretch gap-2">
                    <select
                      aria-label={t("admin-b.workspaces.modelFor", {
                        name: workspace.displayName,
                      })}
                      className="text-sm bg-transparent border rounded-md px-2 py-1"
                      disabled={setModel.isPending}
                      value={
                        chosen
                          ? `${chosen.provider}|${chosen.vertexLocation}|${chosen.defaultModel}`
                          : ""
                      }
                      onChange={(event) => {
                        const [provider, vertexLocation, defaultModel] =
                          event.target.value.split("|");
                        if (!provider || !vertexLocation || !defaultModel)
                          return;
                        setModel.mutate({
                          id: workspace.id,
                          provider,
                          vertexLocation,
                          defaultModel,
                        });
                      }}
                    >
                      {!chosen ? (
                        <option value="">
                          {t("admin-b.workspaces.ownSetting")}
                        </option>
                      ) : null}
                      {MODEL_CHOICES.map((choice) => (
                        <option
                          key={`${choice.provider}|${choice.defaultModel}`}
                          value={`${choice.provider}|${choice.vertexLocation}|${choice.defaultModel}`}
                        >
                          {choice.short}
                        </option>
                      ))}
                    </select>
                    {/*
                     * The option holds the short name and the long one sits under the select: at
                     * 340px the select clipped exactly the part that said whether traffic stays in
                     * the EU, which is the one thing the page asks somebody to decide on.
                     */}
                    {chosen ? (
                      <p className="text-muted-foreground text-xs">
                        {chosen.label}
                      </p>
                    ) : null}
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
  const t = useT();
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
          ? t("admin-b.workspaces.noDriveFolder")
          : t(
              roots.length === 1
                ? "admin-b.workspaces.driveFoldersOne"
                : "admin-b.workspaces.driveFoldersOther",
              { count: roots.length },
            )}
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
        aria-label={t("admin-b.workspaces.driveFolderLinks")}
        className="w-64 rounded-md border bg-transparent px-2 py-1 font-mono text-xs"
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
        placeholder={t("admin-b.workspaces.driveFolderPlaceholder")}
        rows={2}
        value={value}
      />
      <div className="flex gap-2">
        <Button disabled={disabled} size="sm" type="submit">
          {t("admin-b.workspaces.save")}
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
          {t("admin-b.workspaces.cancel")}
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
  const t = useT();
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
        {open
          ? t("admin-b.workspaces.hideMembers")
          : t("admin-b.workspaces.members", { count: rows.length })}
      </button>
      {open ? (
        <div className="mt-2 flex flex-col gap-2">
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              {t("admin-b.workspaces.noMembers")}
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
                {t("admin-b.workspaces.remove")}
              </Button>
            </div>
          ))}
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!email.trim()) return;
              add.mutate(
                { id: workspaceId, email: email.trim(), role },
                { onSuccess: () => setEmail("") },
              );
            }}
          >
            {/* Takes a row of its own when the role and the button would leave it too narrow to read an address in. */}
            <Input
              aria-label={t("admin-b.workspaces.emailAddress")}
              className="h-8 min-w-0 flex-[1_1_12rem] text-sm"
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t("admin-b.workspaces.emailPlaceholder")}
              type="email"
              value={email}
            />
            <select
              aria-label={t("admin-b.workspaces.role")}
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
              {t("admin-b.workspaces.add")}
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
