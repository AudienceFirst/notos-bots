// NOTOS: geen eigen loginformulier; inloggen gebeurt in NOTOS en deze pagina wijst ernaartoe (stap 1).
import { createFileRoute, redirect } from "@tanstack/react-router";
import AgentOrb from "@/components/agents/orb/agent-orb";
import { Button } from "@/components/ui/button";
import { signInUrl } from "@/lib/auth/client";
import { appConfig } from "@/lib/generated/application-config";
import { currentUserQueryOptions } from "../lib/auth/queries";

export const Route = createFileRoute("/sign")({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(
      currentUserQueryOptions(),
    );
    if (user) {
      throw redirect({ to: "/" });
    }
  },
  component: SignScreen,
});

/**
 * Wie hier komt heeft geen NOTOS-sessie. Onder notos.zuid.com/bots/ is dat zeldzaam (de sessie is
 * gedeeld); lokaal is het de normale eerste stap. In beide gevallen is het antwoord hetzelfde: log in
 * bij NOTOS en kom terug.
 */
function SignScreen() {
  return (
    <div className="flex flex-col h-dvh w-full items-center justify-center -mt-12">
      <div className="flex-1 flex w-full max-w-82 flex-col items-center justify-center p-4">
        <div className="flex items-center justify-center">
          <AgentOrb size="56px" />
        </div>
        <h1 className="text-2xl font-medium tracking-tight text-center mt-8">
          {appConfig.brand.productName}
        </h1>
        <p className="mt-3 text-center text-sm text-muted-foreground">
          You sign in at NOTOS. Once you are signed in there, this works by
          itself.
        </p>
        <Button
          className="mt-8 h-10 w-full tracking-tight"
          render={<a href={signInUrl()} />}
        >
          Sign in at NOTOS
        </Button>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Lokaal: log in op notos.zuid.com in dezelfde browser en herlaad deze
          pagina.
        </p>
      </div>
    </div>
  );
}
