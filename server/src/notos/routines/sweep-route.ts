// NOTOS: één sweep per aanroep, voor Cloud Scheduler en voor wie het verder wil starten (stap 9).
/*
 * Upstream ran a worker in an endless loop of thirty-second ticks. On Cloud Run that is a second
 * always-on service. The sweep itself was already safe to call from anywhere (work_items with
 * `for update skip locked`, one key per routine and minute, CAS on next_run_at), so it becomes one
 * endpoint that Cloud Scheduler calls every minute with an OIDC token, and that a person can call
 * with the worker secret locally. Dispatch is in-process: the runner is in this same server.
 */
import { OAuth2Client } from "google-auth-library";
import { Hono, type MiddlewareHandler } from "hono";
import type { AppVariables } from "../../auth/guards";
import { sameToken } from "../../agents/callback-token";

export type SweepReport = {
  considered: number;
  offered: number;
  dispatched: number;
  fired: string[];
};

export type SweepCallerVerifier = (
  authorization: string | undefined,
) => Promise<{ ok: true; as: string } | { ok: false; reason: string }>;

/**
 * Who may ask for a sweep: a caller with the worker secret (local, n8n on the same network), or a
 * Google identity token for one of this deployment's own service accounts, minted for one of the
 * audiences this deployment answers on (the Cloud Run URL, and the public URL behind the worker).
 */
export function createSweepCallerVerifier(options: {
  sharedSecret?: string;
  audiences: readonly string[];
  serviceAccounts: readonly string[];
  verify?: (
    token: string,
  ) => Promise<{ email?: string; aud?: string | string[] } | null>;
}): SweepCallerVerifier {
  const client = new OAuth2Client();
  const verify =
    options.verify ??
    (async (token: string) => {
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: [...options.audiences],
      });
      const payload = ticket.getPayload();
      return payload
        ? { email: payload.email, aud: payload.aud as string | string[] }
        : null;
    });

  return async (authorization) => {
    const token = authorization?.replace(/^Bearer\s+/i, "").trim();
    if (!token) return { ok: false, reason: "missing-header" };
    if (
      options.sharedSecret &&
      sameToken(`Bearer ${token}`, `Bearer ${options.sharedSecret}`)
    ) {
      return { ok: true, as: "worker-secret" };
    }
    if (
      options.serviceAccounts.length === 0 ||
      options.audiences.length === 0
    ) {
      return { ok: false, reason: "no-service-accounts" };
    }
    try {
      const payload = await verify(token);
      const email = payload?.email ?? "";
      if (!email || !options.serviceAccounts.includes(email)) {
        return { ok: false, reason: "not-a-known-service-account" };
      }
      return { ok: true, as: email };
    } catch {
      return { ok: false, reason: "invalid-token" };
    }
  };
}

export function createSweepRoutes(options: {
  run: () => Promise<SweepReport>;
  verifyCaller: SweepCallerVerifier;
  audit?: (event: {
    eventType: "routines.dispatch_refused" | "routines.sweep";
    payload: Record<string, unknown>;
  }) => Promise<void>;
}) {
  const routes = new Hono<{ Variables: AppVariables }>();
  const guard: MiddlewareHandler<{ Variables: AppVariables }> = async (
    context,
    next,
  ) => {
    const verdict = await options.verifyCaller(
      context.req.header("authorization"),
    );
    if (!verdict.ok) {
      await options
        .audit?.({
          eventType: "routines.dispatch_refused",
          payload: {
            reason: verdict.reason,
            note: "A sweep was asked for without a worker secret or a known service account's identity token.",
          },
        })
        .catch(() => undefined);
      return context.json({ error: "Not authorised." }, 401);
    }
    context.set("sweepCaller" as never, verdict.as as never);
    await next();
  };

  routes.post("/internal/routines/sweep", guard, async (context) => {
    const report = await options.run();
    await options
      .audit?.({
        eventType: "routines.sweep",
        payload: {
          caller: (context.var as Record<string, unknown>).sweepCaller,
          ...report,
        },
      })
      .catch(() => undefined);
    return context.json(report);
  });

  return routes;
}
