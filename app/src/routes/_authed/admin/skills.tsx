import { IconFileText, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { useState } from "react";
import { BotGrantPicker } from "@/components/admin/bot-grant-picker";
import {
  PageEmpty,
  PageRows,
  PageSection,
  PageShell,
} from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/i18n";
import { useBotNames } from "@/lib/agents/bot-names";
import { agentListQueryOptions } from "@/lib/agents/queries";
import {
  invalidatePlugins,
  type PluginKind,
  removeSkillMutationOptions,
  saveSkillMutationOptions,
  setPluginGrantMutationOptions,
} from "@/lib/plugins/mutations";
import {
  pluginKeys,
  type PluginsPage,
  pluginsPageQueryOptions,
} from "@/lib/plugins/queries";

/**
 * The deployment's skills: named instructions a person invokes with `/` and a Bot follows.
 *
 * Its own screen rather than a tab on Plugins, because a skill is not a connector. It adds no
 * capability at all — it can only ask a Bot to use tools that Bot was already granted, and every one
 * of those calls is still decided, policy-checked and audited. That is why anybody may write one for
 * themselves on their own Skills page, while adding an MCP server stays an administrator's decision.
 * Sitting in a list of vendors made it look like a third kind of thing a Bot could reach.
 */
export const Route = createFileRoute("/_authed/admin/skills")({
  component: RouteComponent,
});

const EMPTY_DRAFT = { slug: "", title: "", summary: "", instructions: "" };

type Translate = ReturnType<typeof useT>;

/** How widely a skill is granted, as a sentence rather than a wall of chips. */
function grantedLine(t: Translate, held: number, total: number): string {
  if (total === 0) return t("admin-b.skills.grantedNone");
  if (held === 0) return t("admin-b.skills.grantedToNone");
  if (held === total)
    return t(
      total === 1
        ? "admin-b.skills.grantedToAllOne"
        : "admin-b.skills.grantedToAllOther",
      { total },
    );
  return t("admin-b.skills.grantedToSome", { held, total });
}

function RouteComponent() {
  const queryClient = useQueryClient();
  const plugins = useQuery(pluginsPageQueryOptions());
  const { data: agents } = useQuery(agentListQueryOptions());
  const nameFor = useBotNames();
  const t = useT();

  const [error, setError] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  /** The skill whose grants are open in the picker, by slug. */
  const [managing, setManaging] = useState<string | null>(null);
  /** The skill a removal is being confirmed for, by slug. */
  const [removing, setRemoving] = useState<string | null>(null);

  const report = { onError: (thrown: Error) => setError(thrown.message) };
  const saveSkill = useMutation({
    ...saveSkillMutationOptions(queryClient),
    ...report,
  });
  const removeSkill = useMutation({
    ...removeSkillMutationOptions(queryClient),
    ...report,
  });
  /*
   * The grant is drawn before the server answers, and put back if it refuses.
   *
   * The mutation refetches the page on success, but a refetch of every plugin, tool and grant in the
   * deployment takes long enough that a revoked grant stayed drawn as held for seconds after the
   * click — long enough to read as the click not having worked, and to click again. Patching the
   * cached page first makes both directions immediate; the refetch then confirms or corrects it.
   */
  const setGrant = useMutation({
    ...setPluginGrantMutationOptions(queryClient),
    onMutate: async (variables: {
      kind: PluginKind;
      ref: string;
      agentId: string;
      granted: boolean;
    }) => {
      await queryClient.cancelQueries({ queryKey: pluginKeys.page() });
      queryClient.setQueryData<PluginsPage>(pluginKeys.page(), (current) =>
        current
          ? {
              ...current,
              skills: current.skills.map((skill) =>
                skill.slug === variables.ref
                  ? {
                      ...skill,
                      grantedTo: variables.granted
                        ? [...new Set([...skill.grantedTo, variables.agentId])]
                        : skill.grantedTo.filter(
                            (id) => id !== variables.agentId,
                          ),
                    }
                  : skill,
              ),
            }
          : current,
      );
    },
    onError: (thrown: Error) => {
      setError(thrown.message);
      /* The patch above may now be wrong; the refetch puts the page back to what the server holds. */
      void invalidatePlugins(queryClient);
    },
  });

  const bots = (agents ?? []).map((agent: { id: string }) => ({
    id: agent.id,
    name: nameFor(agent.id),
  }));
  const skills = plugins.data?.skills ?? [];
  const managed = skills.find((skill) => skill.slug === managing) ?? null;

  return (
    <PageShell
      action={
        <Button onClick={() => setWriting(true)} size="lg" type="button">
          <IconPlus />
          {t("admin-b.skills.write")}
        </Button>
      }
      description={t("admin-b.skills.description")}
      title={t("admin-b.skills.title")}
    >
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <PageSection
        description={t("admin-b.skills.installedDescription")}
        title={t("admin-b.skills.installed")}
      >
        {plugins.isPending ? null : skills.length === 0 ? (
          <PageEmpty>{t("admin-b.skills.empty")}</PageEmpty>
        ) : (
          <PageRows>
            {skills.map((skill, index) => {
              const held = bots.filter((bot) =>
                skill.grantedTo.includes(bot.id),
              ).length;
              return (
                <React.Fragment key={skill.slug}>
                  <Item size="sm">
                    <ItemMedia variant="icon">
                      <IconFileText className="size-4" />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>
                        <code className="font-mono text-foreground/80 text-xs">
                          /{skill.slug}
                        </code>{" "}
                        {skill.title}
                      </ItemTitle>
                      <ItemDescription>{skill.summary}</ItemDescription>
                      {/*
                       * One line and a way in, where every Bot used to be a chip. Five skills times
                       * 273 Bots was 1,365 buttons, each writing a grant on a single click.
                       */}
                      <ItemFooter className="justify-start">
                        <button
                          className="text-muted-foreground text-xs hover:text-foreground"
                          onClick={() => setManaging(skill.slug)}
                          type="button"
                        >
                          {grantedLine(t, held, bots.length)} ·{" "}
                          {t("admin-b.skills.manage")}
                        </button>
                      </ItemFooter>
                    </ItemContent>
                    <ItemActions>
                      <Button
                        onClick={() => setRemoving(skill.slug)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        {t("admin-b.skills.remove")}
                      </Button>
                    </ItemActions>
                  </Item>
                  {index !== skills.length - 1 && <Separator />}
                </React.Fragment>
              );
            })}
          </PageRows>
        )}
      </PageSection>

      <Dialog onOpenChange={setWriting} open={writing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin-b.skills.writeTitle")}</DialogTitle>
            <DialogDescription>
              {t("admin-b.skills.writeDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="mt-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="skill-slug">
                  {t("admin-b.skills.slug")}
                </FieldLabel>
                <Input
                  id="skill-slug"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      slug: event.target.value,
                    }))
                  }
                  placeholder={t("admin-b.skills.slugPlaceholder")}
                  value={draft.slug}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="skill-title">
                  {t("admin-b.skills.titleLabel")}
                </FieldLabel>
                <Input
                  id="skill-title"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder={t("admin-b.skills.titlePlaceholder")}
                  value={draft.title}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="skill-summary">
                  {t("admin-b.skills.summary")}
                </FieldLabel>
                <Input
                  id="skill-summary"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      summary: event.target.value,
                    }))
                  }
                  placeholder={t("admin-b.skills.summaryPlaceholder")}
                  value={draft.summary}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="skill-instructions">
                  {t("admin-b.skills.instructions")}
                </FieldLabel>
                <Textarea
                  className="h-28 font-mono text-sm"
                  id="skill-instructions"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      instructions: event.target.value,
                    }))
                  }
                  placeholder={t("admin-b.skills.instructionsPlaceholder")}
                  value={draft.instructions}
                />
              </Field>
            </FieldGroup>
          </DialogBody>
          <DialogFooter className="mt-4">
            <Button onClick={() => setWriting(false)} size="sm" variant="ghost">
              {t("admin-b.skills.cancel")}
            </Button>
            <Button
              disabled={!(draft.slug && draft.title && draft.instructions)}
              onClick={() => {
                // Admin-authored skills are the deployment's; a person's own are made elsewhere.
                saveSkill.mutate({ ...draft, global: true });
                setDraft(EMPTY_DRAFT);
                setWriting(false);
              }}
              size="sm"
            >
              {t("admin-b.skills.install")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grants for one skill. Each switch writes as it is switched, as on every other grant screen. */}
      <Dialog
        onOpenChange={(open) => {
          if (!open) setManaging(null);
        }}
        open={managed !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("admin-b.skills.whoHas", { slug: managed?.slug ?? "" })}
            </DialogTitle>
            <DialogDescription>
              {t("admin-b.skills.whoHasDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="mt-4">
            {managed ? (
              bots.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {t("admin-b.skills.noBots")}
                </p>
              ) : (
                <BotGrantPicker
                  bots={bots}
                  held={(botId) => managed.grantedTo.includes(botId)}
                  labelFor={(bot) =>
                    t("admin-b.skills.giveLabel", {
                      name: bot.name,
                      slug: managed.slug,
                    })
                  }
                  onChange={(botId, next) => {
                    setError(null);
                    setGrant.mutate({
                      agentId: botId,
                      granted: next,
                      kind: "skill",
                      ref: managed.slug,
                    });
                  }}
                  pendingId={
                    setGrant.isPending
                      ? (setGrant.variables?.agentId ?? null)
                      : null
                  }
                />
              )
            ) : null}
          </DialogBody>
          <DialogFooter className="mt-4">
            <Button onClick={() => setManaging(null)} size="sm">
              {t("admin-b.skills.done")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Removal asks first: it takes the skill from every Bot at once and cannot be undone. */}
      <Dialog
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        open={removing !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("admin-b.skills.removeTitle", { slug: removing ?? "" })}
            </DialogTitle>
            <DialogDescription>
              {t("admin-b.skills.removeDescription", { slug: removing ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button onClick={() => setRemoving(null)} size="sm" variant="ghost">
              {t("admin-b.skills.cancel")}
            </Button>
            <Button
              disabled={removeSkill.isPending}
              onClick={() => {
                if (removing) removeSkill.mutate(removing);
                setRemoving(null);
              }}
              size="sm"
              variant="destructive"
            >
              {t("admin-b.skills.remove")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
