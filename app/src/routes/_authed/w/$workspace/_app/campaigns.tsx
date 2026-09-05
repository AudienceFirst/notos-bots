// NOTOS: campagnes als ruimtes in de workspace (Mitch, 5 september 2026).
import { IconPlus } from "@tabler/icons-react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";
import { useState } from "react";
import {
  PageEmpty,
  PageRows,
  PageSection,
  PageShell,
} from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { currentUserQueryOptions } from "@/lib/auth/queries";
import {
  type Campaign,
  campaignListQueryOptions,
  createCampaignMutationOptions,
  updateCampaignMutationOptions,
} from "@/lib/campaigns/queries";
import { channelListQueryOptions } from "@/lib/channels/queries";
import { keepWorkspace } from "@/notos/workspace";

export const Route = createFileRoute("/_authed/w/$workspace/_app/campaigns")({
  component: CampaignsPage,
});

/**
 * A campaign is a room inside the workspace: its own channels, its own brief, the channel Bots
 * (SEA, Meta, LinkedIn, …) working inside it. Workspace Bots (site, shop, CRM, legal) stay
 * outside. Somebody from ZUID or the client's lead starts one; everybody in the workspace reads.
 */
function CampaignsPage() {
  const { workspace } = Route.useParams();
  const { data: user } = useQuery(currentUserQueryOptions());
  const role = user?.workspaces.find(
    (row) => row.notosClientId === workspace,
  )?.rol;
  const mayManage = role === "zuid" || role === "lead";
  const [showArchived, setShowArchived] = useState(false);
  const campaigns = useQuery(campaignListQueryOptions(showArchived));
  const channels = useInfiniteQuery(channelListQueryOptions());
  const [creating, setCreating] = useState(false);

  const counts = new Map<string, number>();
  for (const channel of channels.data ?? []) {
    if (!channel.campaignId) continue;
    counts.set(channel.campaignId, (counts.get(channel.campaignId) ?? 0) + 1);
  }
  const rows = campaigns.data ?? [];

  return (
    <PageShell
      action={
        mayManage ? (
          <Button size="sm" onClick={() => setCreating((open) => !open)}>
            <IconPlus />
            New campaign
          </Button>
        ) : undefined
      }
      description="A campaign is a room in this workspace: its own channels, its own brief, and the channel Bots working inside it. Site, shop, CRM and legal Bots stay outside, at workspace level."
      title="Campaigns"
    >
      {creating ? <NewCampaignForm onDone={() => setCreating(false)} /> : null}
      {campaigns.isPending ? null : campaigns.error ? (
        <p className="text-destructive text-sm" role="alert">
          The campaigns could not be loaded.
        </p>
      ) : (
        <PageSection>
          {rows.length === 0 ? (
            <PageEmpty>
              {mayManage
                ? "No campaigns yet. Start one with New campaign; the brief you write there goes to every Bot working in it."
                : "No campaigns yet. Somebody from ZUID or the client's lead can start one."}
            </PageEmpty>
          ) : (
            <PageRows>
              {rows.map((campaign, index) => (
                <React.Fragment key={campaign.id}>
                  <CampaignRow
                    campaign={campaign}
                    channels={counts.get(campaign.id) ?? 0}
                    mayManage={mayManage}
                  />
                  {index !== rows.length - 1 && <Separator />}
                </React.Fragment>
              ))}
            </PageRows>
          )}
          <button
            className="mt-3 text-muted-foreground text-xs hover:text-foreground"
            onClick={() => setShowArchived((value) => !value)}
            type="button"
          >
            {showArchived
              ? "Hide archived campaigns"
              : "Show archived campaigns"}
          </button>
        </PageSection>
      )}
    </PageShell>
  );
}

function NewCampaignForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const create = useMutation(createCampaignMutationOptions(queryClient));
  const [name, setName] = useState("");
  const [brief, setBrief] = useState("");

  return (
    <form
      className="mb-6 flex flex-col gap-3 rounded-xl border border-border/60 bg-background p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim().length < 2) return;
        create.mutate(
          { name: name.trim(), brief: brief.trim() },
          {
            onSuccess: () => {
              setName("");
              setBrief("");
              onDone();
            },
          },
        );
      }}
    >
      <label className="flex flex-col gap-1 text-sm" htmlFor="campaign-name">
        <span className="text-muted-foreground text-xs">Name</span>
        <Input
          autoFocus
          id="campaign-name"
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
          placeholder="Q4 sleep campaign"
          value={name}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm" htmlFor="campaign-brief">
        <span className="text-muted-foreground text-xs">
          Brief: goal, audience, period, budget. Every Bot in this campaign
          reads it before it answers.
        </span>
        <Textarea
          id="campaign-brief"
          maxLength={8000}
          onChange={(event) => setBrief(event.target.value)}
          placeholder="Sell 400 mattresses in NL between 1 October and 15 December on a €25.000 media budget; audience 30–55, home owners; Meta and Search; blended CPA under €50."
          rows={5}
          value={brief}
        />
      </label>
      {create.error ? (
        <p className="text-destructive text-xs" role="alert">
          {create.error.message}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button onClick={onDone} size="sm" type="button" variant="ghost">
          Cancel
        </Button>
        <Button disabled={create.isPending} size="sm" type="submit">
          Start campaign
        </Button>
      </div>
    </form>
  );
}

function CampaignRow({
  campaign,
  channels,
  mayManage,
}: {
  campaign: Campaign;
  channels: number;
  mayManage: boolean;
}) {
  const queryClient = useQueryClient();
  const update = useMutation(updateCampaignMutationOptions(queryClient));
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(campaign.name);
  const [brief, setBrief] = useState(campaign.brief);
  const archived = campaign.status === "archived";

  if (editing) {
    return (
      <form
        className="flex flex-col gap-3 py-3"
        onSubmit={(event) => {
          event.preventDefault();
          update.mutate(
            { id: campaign.id, name: name.trim(), brief: brief.trim() },
            { onSuccess: () => setEditing(false) },
          );
        }}
      >
        <Input
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
          value={name}
        />
        <Textarea
          maxLength={8000}
          onChange={(event) => setBrief(event.target.value)}
          rows={6}
          value={brief}
        />
        {update.error ? (
          <p className="text-destructive text-xs" role="alert">
            {update.error.message}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button
            onClick={() => {
              setName(campaign.name);
              setBrief(campaign.brief);
              setEditing(false);
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            Cancel
          </Button>
          <Button disabled={update.isPending} size="sm" type="submit">
            Save
          </Button>
        </div>
      </form>
    );
  }

  return (
    <Item size="sm">
      <ItemContent>
        <ItemTitle>
          {campaign.name}
          {archived ? (
            <span className="ml-2 text-muted-foreground text-xs">archived</span>
          ) : null}
        </ItemTitle>
        <ItemDescription className="line-clamp-2 whitespace-pre-line">
          {campaign.brief ||
            "No brief yet. The Bots will ask before they assume."}
        </ItemDescription>
        <p className="text-muted-foreground text-xs">
          {channels === 1 ? "1 channel" : `${channels} channels`}
        </p>
      </ItemContent>
      <ItemActions>
        {!archived ? (
          <Button
            render={(props) => (
              <Link
                {...props}
                params={keepWorkspace}
                search={{ campaign: campaign.id }}
                to="/w/$workspace/channel/new"
              />
            )}
            size="sm"
            variant="outline"
          >
            Start a channel
          </Button>
        ) : null}
        {mayManage ? (
          <>
            {!archived ? (
              <Button
                onClick={() => setEditing(true)}
                size="sm"
                variant="ghost"
              >
                Edit
              </Button>
            ) : null}
            <Button
              disabled={update.isPending}
              onClick={() =>
                update.mutate({
                  id: campaign.id,
                  status: archived ? "active" : "archived",
                })
              }
              size="sm"
              variant="ghost"
            >
              {archived ? "Restore" : "Archive"}
            </Button>
          </>
        ) : null}
      </ItemActions>
    </Item>
  );
}
