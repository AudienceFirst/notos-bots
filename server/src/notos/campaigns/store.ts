// NOTOS: campagnes als ruimtes binnen een workspace (Mitch, 5 september 2026).
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import type { Database } from "../../db/client";
import { campaigns } from "../../db/schema/campaigns";
import { channels, intelligenceChannelMappings } from "../../db/schema/core";

export type Campaign = {
  id: string;
  workspaceId: string;
  slug: string;
  name: string;
  brief: string;
  status: "active" | "archived";
  createdBy: string | null;
  createdAt: Date;
  archivedAt: Date | null;
};

export type CampaignStore = {
  list(workspaceId: string, includeArchived?: boolean): Promise<Campaign[]>;
  get(workspaceId: string, id: string): Promise<Campaign | null>;
  create(input: {
    workspaceId: string;
    name: string;
    brief?: string;
    createdBy?: string;
  }): Promise<Campaign>;
  update(
    workspaceId: string,
    id: string,
    patch: Partial<Pick<Campaign, "name" | "brief" | "status">>,
  ): Promise<Campaign | null>;
  /** The campaign a thread's channel belongs to, for the Bot's prompt; null outside campaigns. */
  forThread(threadId: string): Promise<Campaign | null>;
};

export class CampaignRefusedError extends Error {}

/** A slug from a name: lower-case, hyphens, no diacritics; unique per workspace by suffix. */
export function slugify(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "campagne";
}

type Row = typeof campaigns.$inferSelect;
const toCampaign = (row: Row): Campaign => ({
  id: row.id,
  workspaceId: row.workspaceId,
  slug: row.slug,
  name: row.name,
  brief: row.brief,
  status: row.status === "archived" ? "archived" : "active",
  createdBy: row.createdBy ?? null,
  createdAt: row.createdAt,
  archivedAt: row.archivedAt ?? null,
});

export function createCampaignStore(database: Database): CampaignStore {
  const get = async (workspaceId: string, id: string) => {
    const [row] = await database
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.workspaceId, workspaceId), eq(campaigns.id, id)))
      .limit(1);
    return row ? toCampaign(row) : null;
  };

  return {
    async list(workspaceId, includeArchived = false) {
      const rows = await database
        .select()
        .from(campaigns)
        .where(
          and(
            eq(campaigns.workspaceId, workspaceId),
            ...(includeArchived ? [] : [isNull(campaigns.archivedAt)]),
          ),
        )
        .orderBy(desc(campaigns.createdAt));
      return rows.map(toCampaign);
    },

    get,

    async create(input) {
      const name = input.name.trim();
      if (name.length < 2 || name.length > 80) {
        throw new CampaignRefusedError(
          "A campaign name is between 2 and 80 characters.",
        );
      }
      const brief = (input.brief ?? "").trim();
      if (brief.length > 8_000) {
        throw new CampaignRefusedError("A brief is at most 8000 characters.");
      }
      const base = slugify(name);
      const taken = new Set(
        (
          await database
            .select({ slug: campaigns.slug })
            .from(campaigns)
            .where(eq(campaigns.workspaceId, input.workspaceId))
        ).map((row) => row.slug),
      );
      let slug = base;
      for (let n = 2; taken.has(slug); n += 1) slug = `${base}-${n}`;
      const [row] = await database
        .insert(campaigns)
        .values({
          workspaceId: input.workspaceId,
          slug,
          name,
          brief,
          createdBy: input.createdBy ?? null,
        })
        .returning();
      if (!row) throw new Error("The campaign could not be written.");
      return toCampaign(row);
    },

    async update(workspaceId, id, patch) {
      const set: Partial<typeof campaigns.$inferInsert> = {};
      if (patch.name !== undefined) {
        const name = patch.name.trim();
        if (name.length < 2 || name.length > 80) {
          throw new CampaignRefusedError(
            "A campaign name is between 2 and 80 characters.",
          );
        }
        set.name = name;
      }
      if (patch.brief !== undefined) {
        if (patch.brief.length > 8_000) {
          throw new CampaignRefusedError("A brief is at most 8000 characters.");
        }
        set.brief = patch.brief.trim();
      }
      if (patch.status !== undefined) {
        set.status = patch.status;
        set.archivedAt = patch.status === "archived" ? new Date() : null;
      }
      if (Object.keys(set).length === 0) return get(workspaceId, id);
      const [row] = await database
        .update(campaigns)
        .set(set)
        .where(
          and(eq(campaigns.workspaceId, workspaceId), eq(campaigns.id, id)),
        )
        .returning();
      return row ? toCampaign(row) : null;
    },

    async forThread(threadId) {
      const [mapping] = await database
        .select({ channelId: intelligenceChannelMappings.channelId })
        .from(intelligenceChannelMappings)
        .where(eq(intelligenceChannelMappings.threadId, threadId))
        .orderBy(asc(intelligenceChannelMappings.channelId))
        .limit(1);
      if (!mapping?.channelId) return null;
      const [channel] = await database
        .select({ campaignId: channels.campaignId })
        .from(channels)
        .where(eq(channels.id, mapping.channelId))
        .limit(1);
      if (!channel?.campaignId) return null;
      const [row] = await database
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, channel.campaignId))
        .limit(1);
      return row ? toCampaign(row) : null;
    },
  };
}

/** What a Bot is told about the campaign it is working in, per run. */
export function campaignPrompt(campaign: Campaign): string {
  return [
    `You are working inside the campaign "${campaign.name}" of this workspace.`,
    campaign.brief
      ? `This message IS the campaign brief, written by the team in NOTOS. Do not look for it in Drive, FRIDA or anywhere else; quote from it when asked.\n\n${campaign.brief}`
      : "The team has not written a brief for this campaign in NOTOS yet. Do not search Drive or elsewhere for one; ask the person for goal, audience, period and budget before you assume them.",
    "Keep every answer, plan and number inside this campaign unless the person says otherwise.",
  ].join("\n\n");
}
