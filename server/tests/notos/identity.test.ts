import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import type { AppVariables } from "../../src/auth/guards";
import {
  bearerFrom,
  createNotosIdentity,
  isInternalAddress,
  RevokedError,
} from "../../src/notos/auth";

/**
 * NOTOS: the guard in front of every route (stap 1).
 *
 * The resolver is faked; what is held is where the token may come from, what a missing, bad or
 * revoked one answers, and that the actor lands on the context.
 */

const ACTOR = {
  id: "user-1",
  email: "mitch@zuid.com",
  name: "Mitch",
  image: null,
  role: "admin" as const,
  isInternal: true,
};

function app(tokens: Record<string, "ok" | "revoked">) {
  const identity = createNotosIdentity({
    actorForToken: async (token) => {
      const outcome = tokens[token];
      if (outcome === "ok") return ACTOR;
      if (outcome === "revoked") throw new RevokedError(ACTOR.email);
      throw new Error("invalid token");
    },
  });
  return new Hono<{ Variables: AppVariables }>().get(
    "/me",
    identity.requireUser,
    (context) => context.json({ user: context.var.actor }),
  );
}

describe("where the token may come from", () => {
  test("X-Notos-Authorization first, then Authorization", () => {
    expect(
      bearerFrom(
        new Request("http://x/", {
          headers: {
            authorization: "Bearer worker-id-token",
            "x-notos-authorization": "Bearer person-token",
          },
        }),
      ),
    ).toBe("person-token");
    expect(
      bearerFrom(
        new Request("http://x/", { headers: { authorization: "Bearer t" } }),
      ),
    ).toBe("t");
  });

  test("the query only counts on a websocket upgrade", () => {
    expect(bearerFrom(new Request("http://x/?access_token=t"))).toBeNull();
    expect(
      bearerFrom(
        new Request("http://x/?access_token=t", {
          headers: { upgrade: "websocket" },
        }),
      ),
    ).toBe("t");
  });

  test("a bare Authorization without Bearer is not a token", () => {
    expect(
      bearerFrom(new Request("http://x/", { headers: { authorization: "t" } })),
    ).toBeNull();
  });
});

describe("the guard", () => {
  test("no token is 401", async () => {
    const response = await app({}).request("http://x/me");
    expect(response.status).toBe(401);
  });

  test("a token the verifier refuses is 401, and says nothing about why", async () => {
    const response = await app({}).request("http://x/me", {
      headers: { authorization: "Bearer nope" },
    });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Authentication required.",
    });
  });

  test("a revoked address is 403", async () => {
    const response = await app({ gone: "revoked" }).request("http://x/me", {
      headers: { authorization: "Bearer gone" },
    });
    expect(response.status).toBe(403);
  });

  test("a good token puts the actor on the context", async () => {
    const response = await app({ good: "ok" }).request("http://x/me", {
      headers: { authorization: "Bearer good" },
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ user: ACTOR });
  });
});

describe("who counts as ZUID", () => {
  test("by domain, case-insensitively, exact match only", () => {
    expect(isInternalAddress("Mitch@ZUID.com", ["zuid.com"])).toBe(true);
    expect(isInternalAddress("guest@client.nl", ["zuid.com"])).toBe(false);
    expect(isInternalAddress("x@notzuid.com", ["zuid.com"])).toBe(false);
    expect(isInternalAddress("x@sub.zuid.com", ["zuid.com"])).toBe(false);
  });
});
