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
import { useT } from "@/i18n";
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

/*
 * The list as it is written down: dictionary keys rather than words, because the words depend on
 * the person's language and are looked up at render time in `useAdminGroups`.
 */
type AdminNavItemSpec = Omit<AdminNavItem, "title" | "description"> & {
  titleKey: string;
  descriptionKey: string;
};

type AdminNavGroupSpec = {
  labelKey: string;
  descriptionKey?: string;
  items: AdminNavItemSpec[];
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
export const GROUPS: AdminNavGroupSpec[] = [
  {
    labelKey: "admin-a.admin-sidebar.groupReachLabel",
    descriptionKey: "admin-a.admin-sidebar.groupReachDescription",
    items: [
      {
        titleKey: "admin-a.admin-sidebar.credentialsTitle",
        descriptionKey: "admin-a.admin-sidebar.credentialsDescription",
        icon: IconKey,
        linkOptions: { to: "/admin/credentials" },
      },
      {
        titleKey: "admin-a.admin-sidebar.boundariesTitle",
        descriptionKey: "admin-a.admin-sidebar.boundariesDescription",
        icon: IconShieldCheck,
        linkOptions: { to: "/admin/boundaries" },
        needsComputers: true,
      },
      {
        titleKey: "admin-a.admin-sidebar.computersTitle",
        descriptionKey: "admin-a.admin-sidebar.computersDescription",
        icon: IconDeviceDesktop,
        linkOptions: { to: "/admin/computers" },
        needsComputers: true,
      },
    ],
  },
  {
    labelKey: "admin-a.admin-sidebar.groupDoLabel",
    descriptionKey: "admin-a.admin-sidebar.groupDoDescription",
    items: [
      {
        titleKey: "admin-a.admin-sidebar.pluginsTitle",
        descriptionKey: "admin-a.admin-sidebar.pluginsDescription",
        icon: IconPuzzle,
        linkOptions: { to: "/admin/plugins" },
      },
      {
        // NOTOS: API keys for the keyed model providers (5 September 2026).
        titleKey: "admin-a.admin-sidebar.modelsTitle",
        descriptionKey: "admin-a.admin-sidebar.modelsDescription",
        icon: IconSparkles,
        linkOptions: { to: "/admin/models" },
      },
      {
        titleKey: "admin-a.admin-sidebar.skillsTitle",
        descriptionKey: "admin-a.admin-sidebar.skillsDescription",
        icon: IconFileText,
        linkOptions: { to: "/admin/skills" },
      },
      {
        titleKey: "admin-a.admin-sidebar.componentsTitle",
        descriptionKey: "admin-a.admin-sidebar.componentsDescription",
        icon: IconLayoutGrid,
        linkOptions: { to: "/admin/components" },
      },
      {
        titleKey: "admin-a.admin-sidebar.playgroundTitle",
        descriptionKey: "admin-a.admin-sidebar.playgroundDescription",
        icon: IconCode,
        linkOptions: { to: "/admin/playground" },
      },
    ],
  },
  {
    labelKey: "admin-a.admin-sidebar.groupAccessLabel",
    items: [
      {
        titleKey: "admin-a.admin-sidebar.peopleTitle",
        descriptionKey: "admin-a.admin-sidebar.peopleDescription",
        icon: IconUsers,
        linkOptions: { to: "/admin/people" },
      },
      {
        // NOTOS: which model each workspace runs on, and where (stap 3).
        titleKey: "admin-a.admin-sidebar.workspacesTitle",
        descriptionKey: "admin-a.admin-sidebar.workspacesDescription",
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
    labelKey: "admin-a.admin-sidebar.groupHappenedLabel",
    items: [
      {
        titleKey: "admin-a.admin-sidebar.auditTitle",
        descriptionKey: "admin-a.admin-sidebar.auditDescription",
        icon: IconListDetails,
        linkOptions: { to: "/admin/audit" },
      },
    ],
  },
];

/**
 * The groups as this deployment can offer them, in the person's language.
 *
 * Boundaries and Computers are about a Bot's computer, and a deployment without computers has no
 * policy route and no fleet route: both screens could only show an error. They are left out of the
 * rail and the overview alike rather than greyed, because a link marked "off" still asks to be
 * tried. While the answer is not in yet — or the server could not give one — they stay, and the
 * screens behind say what happened.
 */
export function useAdminGroups(): AdminNavGroup[] {
  const t = useT();
  const capabilities = useQuery(deploymentCapabilitiesQueryOptions());
  const computersOff = capabilities.data?.computers === false;
  return GROUPS.map((group) => ({
    label: t(group.labelKey),
    description: group.descriptionKey ? t(group.descriptionKey) : undefined,
    items: group.items
      .filter((item) => !(computersOff && item.needsComputers))
      .map(({ titleKey, descriptionKey, ...item }) => ({
        ...item,
        title: t(titleKey),
        description: t(descriptionKey),
      })),
  })).filter((group) => group.items.length > 0);
}

export function AdminSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const t = useT();
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
                  {t("admin-a.admin-sidebar.backToApp")}
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
                    {t("admin-a.admin-sidebar.overview")}
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
