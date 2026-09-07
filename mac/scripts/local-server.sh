#!/usr/bin/env bash
# NOTOS Bots op deze Mac: Postgres opstarten, migraties draaien, de server starten.
#
# De Swift-schil roept dit aan en kijkt daarna alleen nog of /health antwoordt. Alles wat met
# processen te maken heeft staat hier, omdat het hier te lezen is.
#
# Verwacht uit de omgeving:
#   NOTOS_BOTS_RESOURCES  de Resources-map in de app-bundel (server, migrate, drizzle, app, postgres)
#   NOTOS_BOTS_SUPPORT    ~/Library/Application Support/NOTOS Bots (database, sleutel, logboek)
#   NOTOS_BOTS_PORT       de poort waarop de server moet luisteren
set -euo pipefail

RES="${NOTOS_BOTS_RESOURCES:?}"
SUP="${NOTOS_BOTS_SUPPORT:?}"
PORT="${NOTOS_BOTS_PORT:-3011}"

PGROOT="$RES/postgres"
PGDATA="$SUP/pgdata"
PGLOG="$SUP/logs/postgres.log"
KEYFILE="$SUP/key"
PGPASSFILE="$SUP/pgpass"
PGPORTFILE="$SUP/pgport"

mkdir -p "$SUP/logs"

say() { echo "[local-server] $*"; }

# Alles wat we starten gaat samen weer uit. De schil stuurt TERM naar de procesgroep, maar een
# Postgres die daar doorheen glipt laat een draaiende database achter zonder venster.
cleanup() {
  if [ -n "${SERVER_PID:-}" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
  if [ -d "$PGDATA" ]; then
    "$PGROOT/bin/pg_ctl" -D "$PGDATA" -m fast stop >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

# De sleutel waarmee opgeslagen API-sleutels versleuteld worden, en het wachtwoord van de lokale
# database. Allebei hier gemaakt en nooit meegeleverd: iets dat in het installatiebestand zit is
# op elke Mac hetzelfde en dus geen geheim.
umask 077
if [ ! -f "$KEYFILE" ]; then
  /usr/bin/openssl rand -base64 32 > "$KEYFILE"
  say "nieuwe versleutelsleutel aangemaakt"
fi
if [ ! -f "$PGPASSFILE" ]; then
  /usr/bin/openssl rand -hex 24 > "$PGPASSFILE"
fi
KEY="$(cat "$KEYFILE")"
PGPASS="$(cat "$PGPASSFILE")"

# Postgres praat hier over TCP op de loopback, niet over een unix-socket. Bun's SQL-client kan geen
# socketpad in een verbindings-URL aan (getest: geen enkele schrijfwijze werkt), en de server en de
# migrator gebruiken allebei die client. Loopback plus een wachtwoord dat per installatie verschilt
# is het alternatief; van buiten de Mac is er niets te bereiken.
if [ ! -f "$PGPORTFILE" ]; then
  CHOSEN=""
  for candidate in $(seq 5440 5480); do
    if ! /usr/bin/nc -z 127.0.0.1 "$candidate" >/dev/null 2>&1; then CHOSEN="$candidate"; break; fi
  done
  [ -n "$CHOSEN" ] || { say "geen vrije poort tussen 5440 en 5480"; exit 1; }
  echo "$CHOSEN" > "$PGPORTFILE"
fi
PGPORT="$(cat "$PGPORTFILE")"

if [ ! -f "$PGDATA/PG_VERSION" ]; then
  say "database aanmaken (eenmalig)"
  PWFILE="$(/usr/bin/mktemp)"
  printf '%s' "$PGPASS" > "$PWFILE"
  "$PGROOT/bin/initdb" -D "$PGDATA" -U notos --encoding=UTF8 --locale=C \
    --auth-local=trust --auth-host=scram-sha-256 --pwfile="$PWFILE" >>"$PGLOG" 2>&1
  rm -f "$PWFILE"
fi

if ! "$PGROOT/bin/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then
  say "Postgres starten op 127.0.0.1:$PGPORT"
  "$PGROOT/bin/pg_ctl" -D "$PGDATA" -l "$PGLOG" \
    -o "-h 127.0.0.1 -p $PGPORT -c listen_addresses=127.0.0.1" -w start >>"$PGLOG" 2>&1
fi

export PGPASSWORD="$PGPASS"
if ! "$PGROOT/bin/psql" -h 127.0.0.1 -p "$PGPORT" -U notos -d postgres -tAc \
     "select 1 from pg_database where datname='notos'" 2>/dev/null | grep -q 1; then
  say "databank 'notos' aanmaken"
  "$PGROOT/bin/createdb" -h 127.0.0.1 -p "$PGPORT" -U notos notos >>"$PGLOG" 2>&1
fi

export DATABASE_URL="postgres://notos:${PGPASS}@127.0.0.1:${PGPORT}/notos"
export MIGRATIONS_DIR="$RES/drizzle"
export APP_DIST_DIR="$RES/app"
export NOTOS_CLIENTS_FILE="$RES/clients.json"
export KEY_ENCRYPTION_KEY="$KEY"
export OPENBOT_SINGLE_USER=true
export PORT="$PORT"
export SERVER_PORT="$PORT"
export OPENBOT_PUBLIC_URL="http://127.0.0.1:$PORT"
export OPENBOT_APP_URL="http://127.0.0.1:$PORT"
export TRUSTED_ORIGINS="http://127.0.0.1:$PORT,http://localhost:$PORT"
export COPILOTKIT_TELEMETRY_DISABLED=true
export DO_NOT_TRACK=1
export AI_SDK_LOG_WARNINGS=false
export DATABASE_POOL_MAX=4

say "migraties draaien"
"$RES/bin/notos-bots-migrate"

say "server starten op poort $PORT"
"$RES/bin/notos-bots-server" &
SERVER_PID=$!
wait "$SERVER_PID"
