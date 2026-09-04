import { createRouter } from "@tanstack/react-router";
import type { RouterContext } from "./router-context";
import { ROUTER_BASE } from "@/notos/base";
import { routeTree } from "./routeTree.gen";

export const router = createRouter({
  routeTree,
  // NOTOS: `/bots` under notos.zuid.com, `` elsewhere (stap 4).
  basepath: ROUTER_BASE || undefined,
  context: {} as RouterContext,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
