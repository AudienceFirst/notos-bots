import {
  IconArrowLeft,
  IconCode,
  IconDeviceDesktop,
  IconFileText,
  IconKey,
  IconLayoutGrid,
  IconListDetails,
  IconPuzzle,
  IconSparkles,
  IconShieldCheck,
  IconUsers,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Link, type LinkOptions } from "@tanstack/react-router";
import type * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { deploymentCapabilitiesQueryOptions } from "@/lib/deployment/queries";

const appLinkOptions = { to: "/" } satisfies LinkOptions;
const adminLinkOptions = { to: "/admin" } satisfies LinkOptions;

export type AdminNavItem = {
  title: string;
  /** What the overview says under the title. The rail shows the title alone. */
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  linkOptions: LinkOptions;
  /** Only worth offering while Bots have computers; see `useAdminGroups`. */
  needsComputers?: boolean;
};

export type AdminNavGroup = {
  label: string;
  description?: string;
  items: AdminNavItem[];
};

/**
 * The four groups, in one place, for the rail and the overview both.
 *
 * A rail that lists ten things flat asks somebody to know which of them is the one they want. The
 * grouping is the only navigation help this screen offers, so it has to agree with the page it
 * navigates to — and written out twice, the two had already drifted: the overview offered a dead
 * screen the rail had dropped, and lacked two the rail had. The descriptions live here as well,
 * so the overview is this list drawn with more words, not a second list.
 */
export const GROUPS: AdminNavGroup[] = [
  {
    label: "What Bots can reach",
    description:
      "Everything a Bot can touch outside this app, and the limits on it.",
    items: [
      {
        title: "Credentials",
        description: "Keys and tokens held for this deployment.",
        icon: IconKey,
        linkOptions: { to: "/admin/credentials" },
      },
      {
        title: "Boundaries",
        description: "Rules that decide what a Bot may never do.",
        icon: IconShieldCheck,
        linkOptions: { to: "/admin/boundaries" },
        needsComputers: true,
      },
      {
        title: "Computers",
        description: "The machines Bots run their tools on.",
        icon: IconDeviceDesktop,
        linkOptions: { to: "/admin/computers" },
        needsComputers: true,
      },
    ],
  },
  {
    label: "What Bots can do",
    description: "Capabilities and interface pieces available across Bots.",
    items: [
      {
        title: "Plugins",
        description:
          "The services this deployment can reach, and which Bots may.",
        icon: IconPuzzle,
        linkOptions: { to: "/admin/plugins" },
      },
      {
        // NOTOS: API keys for the keyed model providers (5 September 2026).
        title: "Models",
        description:
          "API keys for the model providers that need one; Gemini on Vertex needs none.",
        icon: IconSparkles,
        linkOptions: { to: "/admin/models" },
      },
      {
        title: "Skills",
        description: "Named instructions anybody can invoke with a slash.",
        icon: IconFileText,
        linkOptions: { to: "/admin/skills" },
      },
      {
        title: "UI Components",
        description: "Custom pieces a Bot can draw in a conversation.",
        icon: IconLayoutGrid,
        linkOptions: { to: "/admin/components" },
      },
      {
        title: "Playground",
        description: "Write a component and watch it render as you type.",
        icon: IconCode,
        linkOptions: { to: "/admin/playground" },
      },
    ],
  },
  {
    label: "Who can get in",
    items: [
      {
        title: "People",
        description:
          "Everybody who has signed in, who administers this deployment, and whose access has been removed.",
        icon: IconUsers,
        linkOptions: { to: "/admin/people" },
      },
      {
        // NOTOS: which model each workspace runs on, and where (stap 3).
        title: "Workspaces",
        description:
          "Every NOTOS client, the model it runs on, its Drive folders and who is in it.",
        icon: IconLayoutGrid,
        linkOptions: { to: "/admin/workspaces" },
      },
      /*
       * NOTOS: no "Identity providers" entry. Sign-in happens in NOTOS (stap 1); the screen and its
       * sso_providers rows are still in the tree but do nothing, and a dead screen in a menu reads
       * as a broken one. The route redirects to the overview until it goes with react-core in stap 10.
       */
    ],
  },
  {
    label: "What happened",
    items: [
      {
        title: "Audit",
        description: "Every action taken in this deployment, and by whom.",
        icon: IconListDetails,
        linkOptions: { to: "/admin/audit" },
      },
    ],
  },
];

/**
 * The groups as this deployment can offer them.
 *
 * Boundaries and Computers are about a Bot's computer, and a deployment without computers has no
 * policy route and no fleet route: both screens could only show an error. They are left out of the
 * rail and the overview alike rather than greyed, because a link marked "off" still asks to be
 * tried. While the answer is not in yet — or the server could not give one — they stay, and the
 * screens behind say what happened.
 */
export function useAdminGroups(): AdminNavGroup[] {
  const capabilities = useQuery(deploymentCapabilitiesQueryOptions());
  if (capabilities.data?.computers !== false) return GROUPS;
  return GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.needsComputers),
  })).filter((group) => group.items.length > 0);
}

export function AdminSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const groups = useAdminGroups();
  return (
    <Sidebar {...props}>
      {/*
       * Pinned to the same height as the app sidebar's header. Left to itself this one is 60px
       * against the app's 45px — `p-2` around a `size="lg"` button rather than a fixed height — so
       * the nav list started lower here and the sidebar appeared to shift on the way into Admin.
       *
       * The button takes its default height rather than `h-full`. `h-full` resolves against the
       * parent, which in the app sidebar is a flex row holding a second control and here is not, so
       * the same class produces two different heights.
       */}
      <SidebarHeader className="h-12 p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={(props) => (
                <Link {...appLinkOptions} {...props}>
                  <IconArrowLeft className="mr-2 h-4 w-4" />
                  Back to app
                </Link>
              )}
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              {/*
               * `activeOptions.exact`, because /admin is a prefix of every other route here and
               * would otherwise light up on all of them.
               */}
              <SidebarMenuButton
                render={(props) => (
                  <Link
                    {...adminLinkOptions}
                    activeOptions={{ exact: true }}
                    activeProps={{ className: "bg-foreground/5" }}
                    {...props}
                  >
                    Overview
                  </Link>
                )}
              />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu className="gap-px">
              {group.items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    render={(props) => (
                      <Link
                        {...item.linkOptions}
                        activeProps={{ className: "bg-foreground/5" }}
                        {...props}
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        {item.title}
                      </Link>
                    )}
                  />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
