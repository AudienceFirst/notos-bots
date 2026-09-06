import { IconChevronRight } from "@tabler/icons-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAdminGroups } from "@/components/admin/admin-sidebar";
import {
  PageRows,
  PageSection,
  PageShell,
} from "@/components/layout/page-shell";
import { StaggerItem } from "@/components/layout/stagger";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/_authed/admin/")({
  component: RouteComponent,
});

/**
 * The rail's groups, drawn with a sentence under each link.
 *
 * From the same list as the rail (`admin-sidebar.tsx`) rather than a copy of it. Written out twice
 * they had already drifted: this page offered Identity providers, which the rail had dropped as a
 * dead screen, and lacked Models and Workspaces, which the rail had. What the deployment cannot
 * offer is left out of both at once.
 */
function RouteComponent() {
  const groups = useAdminGroups();
  return (
    <PageShell
      description="Settings that apply to everybody in this deployment. Anything here affects every person and every Bot, which is what separates it from your own preferences."
      title="Admin"
    >
      {groups.map((group) => (
        <PageSection
          description={group.description}
          key={group.label}
          title={group.label}
        >
          <PageRows>
            {group.items.map((item, index) => (
              <StaggerItem index={index} key={item.title}>
                {/*
                 * The whole row is the link, not a chevron somebody has to aim at: every row here
                 * goes exactly one place, so there is nothing else the row could mean.
                 */}
                <Item
                  render={(props) => <Link {...item.linkOptions} {...props} />}
                  size="sm"
                >
                  <ItemMedia>
                    <item.icon className="size-4 text-muted-foreground" />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{item.title}</ItemTitle>
                    <ItemDescription>{item.description}</ItemDescription>
                  </ItemContent>
                  <IconChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Item>
                {index !== group.items.length - 1 && <Separator />}
              </StaggerItem>
            ))}
          </PageRows>
        </PageSection>
      ))}
    </PageShell>
  );
}
