#!/usr/bin/env bash
# NOTOS Bots lokaal, altijd aan via launchd (com.mitch.notos-bots): Docker-Postgres op 5433 erbij,
# daarna de server met de productie-build van de app op http://localhost:3011. Omgeving uit
# ~/.config/notos-bots/local.env (niet in git).
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$HOME/.config/notos-bots/local.env"
[ -f "$ENV_FILE" ] || { echo "geen $ENV_FILE"; exit 1; }
set -a; . "$ENV_FILE"; set +a
export PATH="$HOME/.bun/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

# Docker Desktop komt soms later dan launchd; wacht er even op.
for i in $(seq 1 60); do docker info >/dev/null 2>&1 && break; sleep 5; done
cd "$REPO" && POSTGRES_PORT=5433 docker compose up -d postgres >/dev/null 2>&1 || true
for i in $(seq 1 60); do docker exec notos-bots-postgres-1 pg_isready -U openbot >/dev/null 2>&1 && break; sleep 2; done

cd "$REPO/server" && exec bun src/index.ts
