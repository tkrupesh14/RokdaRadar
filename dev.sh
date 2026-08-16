#!/usr/bin/env bash
# Runs the ReliefTrace backend and frontend dev servers together.
# Ctrl+C stops both cleanly. Logs are written to .dev-logs/ so you can tail
# them separately (or just watch this terminal, which streams "waiting for
# backend" progress before switching to background).
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

mkdir -p "$ROOT_DIR/.dev-logs"
BACKEND_LOG="$ROOT_DIR/.dev-logs/backend.log"
FRONTEND_LOG="$ROOT_DIR/.dev-logs/frontend.log"
: > "$BACKEND_LOG"
: > "$FRONTEND_LOG"

# --- one-time setup convenience -------------------------------------------
if [ ! -f "$BACKEND_DIR/.env" ]; then
  echo "[dev] backend/.env not found -- copying from .env.example (fill in real keys before relying on AI/chain features)"
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
fi

if [ ! -d "$BACKEND_DIR/node_modules" ]; then
  echo "[dev] backend/node_modules missing -- running npm install..."
  (cd "$BACKEND_DIR" && npm install)
fi

if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  echo "[dev] frontend/node_modules missing -- running npm install..."
  (cd "$FRONTEND_DIR" && npm install)
fi

# Clears a stale Next.js dev lock left behind by a previous crashed/killed run
rm -f "$FRONTEND_DIR/.next/dev/lock"

# --- process management -----------------------------------------------
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  echo ""
  echo "[dev] shutting down..."
  [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
  echo "[dev] stopped."
}
trap cleanup EXIT INT TERM

# --- backend -----------------------------------------------------------
BACKEND_PORT="$(grep -E '^PORT=' "$BACKEND_DIR/.env" 2>/dev/null | tail -1 | cut -d= -f2)"
BACKEND_PORT="${BACKEND_PORT:-4000}"

echo "[dev] starting backend on port $BACKEND_PORT (log: $BACKEND_LOG)..."
(cd "$BACKEND_DIR" && npm run dev) >> "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!

echo "[dev] waiting for backend health check..."
backend_up=false
for _ in $(seq 1 30); do
  if curl -sf "http://localhost:${BACKEND_PORT}/health" > /dev/null 2>&1; then
    backend_up=true
    break
  fi
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "[dev] backend process exited early -- see $BACKEND_LOG"
    break
  fi
  sleep 1
done
if [ "$backend_up" = true ]; then
  echo "[dev] backend is up: http://localhost:${BACKEND_PORT} (docs at /docs)"
else
  echo "[dev] backend did not become healthy in time -- continuing anyway, check $BACKEND_LOG"
fi

# --- frontend ------------------------------------------------------------
echo "[dev] starting frontend (log: $FRONTEND_LOG)..."
(cd "$FRONTEND_DIR" && npm run dev) >> "$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!

frontend_url=""
for _ in $(seq 1 30); do
  frontend_url="$(grep -oE 'https?://localhost:[0-9]+' "$FRONTEND_LOG" 2>/dev/null | head -1)"
  [ -n "$frontend_url" ] && break
  if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    echo "[dev] frontend process exited early -- see $FRONTEND_LOG"
    break
  fi
  sleep 1
done

echo ""
echo "======================================================"
echo " ReliefTrace dev environment running"
echo "   Backend:  http://localhost:${BACKEND_PORT}  (docs: /docs, health: /health)"
echo "   Frontend: ${frontend_url:-see $FRONTEND_LOG for the port Next.js picked}"
echo "   Logs:     $BACKEND_LOG"
echo "             $FRONTEND_LOG"
echo "   Press Ctrl+C to stop both."
echo "======================================================"

wait
