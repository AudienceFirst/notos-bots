// NOTOS: de wortel stuurt door naar de eerste workspace van deze persoon (bouwplan stap 2).
import { createFileRoute, redirect } from "@tanstack/react-router";
import { currentUserQueryOptions } from "@/lib/auth/queries";

export const Route = createFileRoute("/_authed/")({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(
      currentUserQueryOptions(),
    );
    const first = user?.workspaces[0];
    if (first) {
      throw redirect({
        to: "/w/$workspace",
        params: { workspace: first.notosClientId },
      });
    }
  },
  component: NoWorkspace,
});

function NoWorkspace() {
  return (
    <div className="flex h-dvh w-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
      Je hebt nog geen workspace. Vraag ZUID om je toe te voegen bij een klant
      in NOTOS onder Instellingen › Toegang.
    </div>
  );
}
