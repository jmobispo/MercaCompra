#!/usr/bin/env bash
# ================================================
# MercaCompra — Development startup script
# Usage: ./scripts/start-dev.sh
# ================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "╔══════════════════════════════════════════╗"
echo "║        MercaCompra — Dev Start           ║"
echo "╚══════════════════════════════════════════╝"

# ── Check Python ───────────────────────────────
if ! command -v python3 &>/dev/null; then
    echo "ERROR: python3 not found. Install Python 3.11+."
    exit 1
fi

# ── Check Node ─────────────────────────────────
if ! command -v node &>/dev/null; then
    echo "ERROR: node not found. Install Node.js 18+."
    exit 1
fi

# ── Backend setup ──────────────────────────────
BACKEND_DIR="$ROOT_DIR/backend"
cd "$BACKEND_DIR"

if [ ! -f ".env" ]; then
    echo "Creating backend .env from .env.example..."
    cp .env.example .env
    echo "  → Edit backend/.env with your settings"
fi

if [ ! -d ".venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv .venv
fi

echo "Activating venv and installing dependencies..."
source .venv/bin/activate
pip install -q -r requirements.txt

echo "Running Alembic migrations..."
alembic upgrade head

echo "Starting backend on http://localhost:8000 ..."
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID"

# ── Frontend setup ─────────────────────────────
FRONTEND_DIR="$ROOT_DIR/frontend"
cd "$FRONTEND_DIR"

if [ ! -f ".env" ]; then
    echo "Creating frontend .env from .env.example..."
    cp .env.example .env
fi

if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

echo "Starting frontend on http://localhost:5173 ..."
npm run dev &
FRONTEND_PID=$!
echo "  Frontend PID: $FRONTEND_PID"

# ── Summary ────────────────────────────────────
echo ""
echo "✅ Services started:"
echo "   Backend:  http://localhost:8000"
echo "   API docs: http://localhost:8000/docs"
echo "   Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all services"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" SIGINT SIGTERM
wait
