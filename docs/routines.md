# Routines

A routine is a standing instruction a Bot carries out on a schedule, as the person who made it:
the same grants, the same connections, the same approvals gate. It posts into one channel.

## How a routine fires (NOTOS, stap 9)

There is no worker process any more. Firing happens in one sweep, and the sweep is an endpoint:

```
POST /internal/routines/sweep
```

Cloud Scheduler calls it every minute with an identity token of `notos-worker@mge-zuid` (audience
= the Cloud Run URL; see `scripts/notos/sweep-scheduler.sh`). Locally, or from n8n on the same
network, the worker secret does the same:

```
curl -X POST http://localhost:3011/internal/routines/sweep -H "Authorization: Bearer $WORKER_SHARED_SECRET"
```

One sweep does two things, in this order, and answers `{ considered, offered, dispatched, fired }`:

1. **Offer**: every enabled routine whose `next_run_at` has passed gets one `work_items` row with
   the key `<routine id>:<minute>`. Two sweeps inside the same minute produce one row, not two
   (`for update skip locked`, and a compare-and-set on `next_run_at`).
2. **Dispatch**: claimed rows are run in-process by the routine runner, which starts one turn of
   the Bot in the routine's channel through the same TurnRunner a person's message uses.

A routine that fails ten times in a row switches itself off and says so in its channel.

## What a schedule may be

Five-field cron, in the routine's time zone (`Europe/Amsterdam` by default on the page). The
shortest interval is fifteen minutes (`MINIMUM_INTERVAL_MS` in `server/src/routines/schedule.ts`);
`*/5 * * * *` is refused with the reason. The Routines page offers presets (every 15 minutes, every
hour, daily at, weekly on) and an advanced box for the five fields.

## Starting one turn from outside

The same door for n8n, a button in NOTOS or another system:

```
POST /api/w/<workspace>/bots/<bot id>/runs
Authorization: Bearer <NOTOS Supabase access token of the caller>
Content-Type: application/json

{ "prompt": "Post a summary of last week's Google Ads results.", "channelId": "channel_…" }
```

The caller must be a person in that workspace (a service user for n8n works the same way). Without
`channelId` the turn runs in the caller's direct channel with the Bot. The answer carries
`channelId`, `threadId` and `reply`. Nothing here bypasses the gateway: a write the Bot attempts
still waits for a person.

n8n: one HTTP Request node, method POST, that URL, header `Authorization: Bearer {{ $json.token }}`,
JSON body with `prompt`. No workflow of its own runs a Bot turn; n8n triggers, the server runs.
