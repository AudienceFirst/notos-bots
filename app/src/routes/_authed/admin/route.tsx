import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { currentUserQueryOptions } from "../../../lib/auth/queries";

export const Route = createFileRoute("/_authed/admin")({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(
      currentUserQueryOptions(),
    );
    if (user?.role !== "admin") {
      throw redirect({ to: "/" });
    }
  },
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <SidebarShell width="300px">
      <AdminSidebar />
      {/*
       * `min-w-0`, or a flex child takes its min-content width from a table inside it and the whole
       * page scrolls sideways on a phone, with the header and filters sliding out of view. With it,
       * a wide table scrolls inside its own `overflow-x-auto` wrapper as the audit page intends.
       */}
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </SidebarShell>
  );
}
