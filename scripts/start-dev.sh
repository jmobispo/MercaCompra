#!/usr/bin/env bash
# MercaCompra — Development start script
# Usage:
#   ./scripts/start-dev.sh          # backend + frontend
#   ./scripts/start-dev.sh --bot    # + bot HTTP service

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
START_BOT=false

for arg in "$@"; do
  case $arg in
    --bot) START_BOT=true ;;
    *) echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

detect_ip() {
  if command -v ip &>/dev/null; then
    ip route get 1.1.1.1 2>/dev/null | awk '/src/{print $7; exit}'
  elif command -v ifconfig &>/dev/null; then
    ifconfig | awk '/inet /{print $2}' | grep -v 127.0.0.1 | head -1
  else
    echo "unknown"
  fi
}

LOCAL_IP=$(detect_ip)

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  MercaCompra — Dev environment starting"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:5173"
if [ "$LOCAL_IP" != "unknown" ] && [ -n "$LOCAL_IP" ]; then
  echo ""
  echo "  From iPad/iPhone/Android on the same WiFi:"
  echo "    http://$LOCAL_IP:5173"
fi
echo ""

if [ ! -f "$ROOT/backend/.env" ]; then
  echo "No backend/.env found — copying from .env.example"
  cp "$ROOT/backend/.env.example" "$ROOT/backend/.env"
fi

echo "Running database migrations..."
cd "$ROOT/backend"
python -m alembic upgrade head
echo "Done."
echo ""

if [ "$START_BOT" = true ]; then
  echo "Starting bot service on :8001..."
  cd "$ROOT"
  uvicorn bot.app.main:app --host 0.0.0.0 --port 8001 --reload &
  BOT_PID=$!
fi

echo "Starting backend on :8000..."
cd "$ROOT/backend"
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

echo "Starting frontend on :5173..."
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "All services running. Press Ctrl+C to stop all."
echo ""

trap 'echo "Stopping..."; kill $BACKEND_PID $FRONTEND_PID ${BOT_PID:-} 2>/dev/null; exit 0' INT TERM

wait
