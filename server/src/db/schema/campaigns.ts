// NOTOS: campagnes binnen een workspace, persoonlijke ruimtes en leden per workspace.
import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { deploymentPackages } from "./core";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/**
 * A campaign is a room inside a workspace: its own channels, its own brief, the channel Bots (SEA,
 * Meta, LinkedIn, …) working inside it. Workspace-level Bots (Webflow, Shopify, HubSpot, Legal)
 * stay outside campaigns. Mitch, 5 September 2026: "campagne = ruimte in de workspace".
 */
export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => deploymentPackages.id, { onDelete: "cascade" }),
    /** URL-safe, unique within the workspace. */
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    /** What the campaign is: goal, audience, period, budget in prose. Goes into every Bot's prompt. */
    brief: text("brief").notNull().default(""),
    /** `active` or `archived`. */
    status: text("status").notNull().default("active"),
    createdBy: text("created_by"),
    createdAt: createdAt(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    index("campaigns_workspace_slug_idx").on(table.workspaceId, table.slug),
  ],
);

/**
 * Who is in a workspace, on top of what NOTOS says (client_members for guests, team_members for
 * ZUID). An administrator adds and removes people here with a role; the actor resolver merges
 * both sources. NOTOS stays the source for client logins; this is the Bots-side roster.
 */
export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => deploymentPackages.id, { onDelete: "cascade" }),
    /** Lower-cased address; the person may not have signed in yet. */
    email: text("email").notNull(),
    /** `zuid`, `lead`, `specialist` or `viewer`; see WorkspaceRole. */
    role: text("role").notNull(),
    addedBy: text("added_by"),
    createdAt: createdAt(),
  },
  (table) => [primaryKey({ columns: [table.workspaceId, table.email] })],
);
