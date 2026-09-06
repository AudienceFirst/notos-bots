import {
  IconArrowLeft,
  IconLayoutGrid,
  IconPlug,
  IconSparkles,
  IconSettings,
} from "@tabler/icons-react";
import { Link, type LinkOptions } from "@tanstack/react-router";
import type * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useT } from "@/i18n";

const appLinkOptions = { to: "/" } satisfies LinkOptions;

const ITEMS: {
  /**
   * Whether this entry lights only on its own route.
   *
   * On for an entry whose path is a prefix of another's, which is the only reason to want it. Off
   * everywhere else, so an entry stays lit on the pages beneath it.
   */
  exact?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  linkOptions: LinkOptions;
  /** Dictionary key of the entry's title, translated at render time. */
  titleKey: string;
}[] = [
  {
    titleKey: "settings.settingsSidebar.general",
    icon: IconSettings,
    /* `/settings` prefixes every other route here, and would otherwise light up on all of them. */
    exact: true,
    linkOptions: { to: "/settings" },
  },
  {
    /*
     * The same subject as Admin's Plugins, from the other side: there an administrator decides what
     * this deployment may reach at all, here you decide what it may reach as you.
     */
    titleKey: "settings.settingsSidebar.connectedAccounts",
    icon: IconPlug,
    linkOptions: { to: "/settings/connected-accounts" },
  },
  {
    /* NOTOS: the model of your personal space, and your own keys for it (5 September 2026). */
    titleKey: "settings.settingsSidebar.models",
    icon: IconSparkles,
    linkOptions: { to: "/settings/models" },
  },
  {
    /* The same mark Admin gives UI Components. It is the same subject seen from the other side. */
    titleKey: "settings.settingsSidebar.componentsGallery",
    icon: IconLayoutGrid,
    linkOptions: { to: "/settings/components-gallery" },
  },
];

export function SettingsSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const t = useT();
  return (
    <Sidebar {...props}>
      {/* Matched to the app sidebar's header, as Admin's is. See admin-sidebar.tsx. */}
      <SidebarHeader className="h-12 p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={(props) => (
                <Link {...appLinkOptions} {...props}>
                  <IconArrowLeft className="mr-2 h-4 w-4" />
                  {t("settings.settingsSidebar.backToApp")}
                </Link>
              )}
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {/*
         * Group outside menu, as Admin has it. The other way round nests a list item inside a div
         * inside the `ul`, which is not markup a list is allowed to be made of.
         */}
        <SidebarGroup>
          <SidebarMenu className="gap-px">
            {ITEMS.map((option) => (
              <SidebarMenuItem key={option.titleKey}>
                <SidebarMenuButton
                  render={(props) => (
                    <Link
                      {...option.linkOptions}
                      activeOptions={{ exact: option.exact ?? false }}
                      activeProps={{ className: "bg-foreground/5" }}
                      {...props}
                    >
                      <option.icon className="mr-2 h-4 w-4" />
                      {t(option.titleKey)}
                    </Link>
                  )}
                />
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
