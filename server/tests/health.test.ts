import { describe, expect, test } from "bun:test";
import { createApp } from "../src/app";
import { loadConfig } from "../src/config";
import { testEnvironment } from "./support/environment";

const app = createApp(
  loadConfig({
    ...testEnvironment(),
  }),
);

describe("health endpoint", () => {
  test("reports the server as healthy", async () => {
    const response = await app.request("http://openbot.local/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });
});

describe("runtime capabilities", () => {
  test("reports the SSE runtime on durable history, and nothing from the configuration", async () => {
    const response = await app.request("http://openbot.local/api/capabilities");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      mode: "sse",
      durableHistory: true,
      // Off until a deployment asks for it. The browser reads this to decide whether to offer the
      // tool that generates an interface, so it has to be here and not only in the runtime.
      generativeUi: false,
      // NOTOS: the one way in. The sign-in screen reads this to know what to say.
      authProviders: ["notos"],
      // A boolean, not a list: naming the registered providers would tell anybody who loads the
      // sign-in page which companies use this deployment.
      ssoConfigured: false,
      // NOTOS: public by design; the browser needs both to find the shared session.
      supabase: {
        url: "https://project.supabase.test",
        publishableKey: "publishable-key",
      },
    });
  });

  // This endpoint has no authentication, so a projection bug here publishes deployment secrets to
  // anyone who asks. NOTOS: the Intelligence credentials are gone; the shape check stays.
  test("never serves anything from the configuration beyond the projected fields", async () => {
    const response = await app.request("http://openbot.local/api/capabilities");
    const body = await response.text();
    const parsed = (await new Response(body).json()) as Record<string, unknown>;

    expect(body).not.toContain("tenant-api-key");
    expect(body).not.toContain("license-token");
    // The settings object itself must not be projected, whatever it happens to hold today.
    expect(Object.keys(parsed)).toEqual([
      "mode",
      "durableHistory",
      "generativeUi",
      "authProviders",
      "ssoConfigured",
      "supabase",
    ]);
    // The provider list is names, never the clients and secrets behind them.
    expect(body).not.toContain("google-client-secret");
  });

  /*
   * The answer has to reach the browser, not just the runtime.
   *
   * The app offers the model the tool that generates an interface, and it decides whether to from
   * this field. The two halves disagreeing is the one configuration this capability must not be able
   * to end up in: runtime-only means the tool is never offered, browser-only means a Bot writes a
   * whole interface that nothing renders.
   */
  test("reports generated interfaces as on when the deployment asked for them", async () => {
    const enabled = createApp(
      loadConfig(testEnvironment({ OPENBOT_GENERATIVE_UI: "true" })),
    );

    const response = await enabled.request(
      "http://openbot.local/api/capabilities",
    );

    expect(response.status).toBe(200);
    expect((await response.json()).generativeUi).toBe(true);
  });
});
