#!/usr/bin/env bash
# Runs everything for local development, in one terminal:
#   - Postgres and Mailpit (docker-compose.yml, with Docker or Podman)
#   - the database migrations
#   - the backend API (:4000) and its job worker, and the UI (http://localhost:3000)
#
#   ./local-dev/run.sh          start everything; Ctrl+C stops the apps (the containers keep running)
#   ./local-dev/run.sh infra    start just the containers and migrate (to run the apps yourself)
#   ./local-dev/run.sh stop     stop the containers
#
# First run: it creates the .env files from their examples and installs dependencies.
# Then create an admin with `pnpm admin:create`, and sign in at http://localhost:3000/admin.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_DEV="$ROOT/local-dev"

say() { printf '\033[1m[run]\033[0m %s\n' "$*"; }
fail() { printf '\033[31m[run]\033[0m %s\n' "$*" >&2; exit 1; }

# --- Container runtime ------------------------------------------------------------

if command -v docker >/dev/null 2>&1; then
  RUNTIME=docker
elif command -v podman >/dev/null 2>&1; then
  RUNTIME=podman
else
  fail "Docker or Podman is needed for Postgres and Mailpit."
fi
compose() { (cd "$LOCAL_DEV" && "$RUNTIME" compose "$@"); }

if [[ "${1:-}" == "stop" ]]; then
  say "stopping the containers"
  compose down
  exit 0
fi

# --- Requirements and first-run setup ----------------------------------------------

for tool in node pnpm; do
  command -v "$tool" >/dev/null 2>&1 || fail "$tool is needed (see README.md)."
done

for dir in backend ui; do
  if [[ ! -f "$ROOT/$dir/.env" ]]; then
    cp "$ROOT/$dir/.env.example" "$ROOT/$dir/.env"
    say "created $dir/.env from its example (local defaults work)"
  fi
done

if [[ ! -d "$ROOT/node_modules" ]]; then
  say "installing dependencies"
  (cd "$ROOT" && pnpm install)
fi

# --- Infrastructure ------------------------------------------------------------------

say "starting the containers ($RUNTIME)"
compose up -d

wait_for() { # name, seconds, command...
  local name="$1" seconds="$2"
  shift 2
  for ((i = 0; i < seconds; i++)); do
    if "$@" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  fail "$name didn't come up within ${seconds}s. Check: (cd local-dev && $RUNTIME compose logs)"
}

say "waiting for Postgres"
wait_for Postgres 60 compose exec -T postgres pg_isready -U saas -d saas

say "applying database migrations"
(cd "$ROOT" && pnpm --silent db:deploy)

if [[ "${1:-}" == "infra" ]]; then
  say "containers are up: Postgres :5432, Mailpit http://localhost:8025"
  exit 0
fi

# --- Apps ----------------------------------------------------------------------------

# Each app runs in its own process group (job control), so stopping one stops all it started.
set -m
PIDS=()

run() { # name, colour, directory, command...
  local name="$1" colour="$2" dir="$3"
  shift 3
  (
    cd "$dir"
    "$@" 2>&1 | awk -v p="$(printf '\033[%sm[%s]\033[0m ' "$colour" "$name")" '{ print p $0; fflush() }'
  ) &
  PIDS+=("$!")
}

stop_apps() {
  trap - INT TERM EXIT
  say "stopping the apps (the containers keep running; ./local-dev/run.sh stop stops them)"
  for pid in "${PIDS[@]}"; do kill -INT -- "-$pid" 2>/dev/null || true; done
  # Give them a moment to shut down cleanly, then make sure.
  for _ in {1..20}; do
    local alive=0
    for pid in "${PIDS[@]}"; do kill -0 "$pid" 2>/dev/null && alive=1; done
    ((alive)) || break
    sleep 0.5
  done
  for pid in "${PIDS[@]}"; do kill -KILL -- "-$pid" 2>/dev/null || true; done
}
trap stop_apps INT TERM EXIT

# The dev runner labels the API, the worker and the UI.
run app 36 "$ROOT" pnpm --silent dev

say "UI: http://localhost:3000 · admin: /admin · emails: http://localhost:8025 · Ctrl+C to stop"

# If any app exits, stop the rest. (A loop, not `wait -n`: macOS ships bash 3.2.)
while true; do
  for pid in "${PIDS[@]}"; do
    if ! kill -0 "$pid" 2>/dev/null; then
      say "an app exited"
      exit 1
    fi
  done
  sleep 1
done
