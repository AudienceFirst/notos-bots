/**
 * The minimum environment a deployment is allowed to boot with, for tests that need a config but are
 * not testing configuration itself.
 *
 * It lives in one place because the minimum is a moving target: upstream once made Intelligence
 * mandatory and five test files each carried their own copy of the environment, so every one of
 * them started failing for a reason that had nothing to do with what it was testing. NOTOS: the
 * Intelligence four are gone again (stap 0); nothing here needs them. Tests that assert on
 * configuration should keep building their environment inline; everything else should spread this.
 */
export function testEnvironment(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    DATABASE_URL: "postgres://openbot:openbot@localhost:5432/openbot",
    KEY_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    // Connectors (Google Drive) keep their OAuth client; sign-in no longer uses it.
    GOOGLE_OAUTH_CLIENT_ID: "google-client-id",
    GOOGLE_OAUTH_CLIENT_SECRET: "google-client-secret",
    // NOTOS: sign-in is the NOTOS Supabase session (stap 1). Configured, so single-user is off.
    SUPABASE_URL: "https://project.supabase.test",
    SUPABASE_PUBLISHABLE_KEY: "publishable-key",
    MANAGED_AGENT_AG_UI_URL: "http://localhost:4200/ag-ui",
    MANAGED_AGENT_TOKEN: "managed-agent-token",
    ...overrides,
  };
}
