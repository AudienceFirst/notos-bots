import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * NOTOS: sign-in runs through NOTOS (stap 1), so there is nothing to configure here.
 *
 * The route stays in the tree until react-core goes with it (stap 10). Until then anybody who lands
 * on it — from an old link or a typed address — is sent to the overview rather than shown a working
 * SAML and OIDC form whose rows nothing reads.
 */
export const Route = createFileRoute("/_authed/admin/identity-providers")({
  beforeLoad: () => {
    throw redirect({ to: "/admin" });
  },
});
