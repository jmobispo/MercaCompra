#!/usr/bin/env bash
# ================================================
# MercaCompra — Initialize/reset the database
# Usage: ./scripts/init-db.sh [--reset]
# ================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")/backend"

cd "$BACKEND_DIR"

if [ ! -d ".venv" ]; then
    echo "No virtual environment found. Run ./scripts/start-dev.sh first."
    exit 1
fi

source .venv/bin/activate

if [ "$1" == "--reset" ]; then
    echo "Resetting database..."
    rm -f mercacompra.db
fi

echo "Running Alembic migrations..."
alembic upgrade head

echo "Database initialized at: $BACKEND_DIR/mercacompra.db"
