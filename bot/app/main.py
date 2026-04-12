"""
MercaCompra Bot — HTTP Service

Exposes a minimal FastAPI interface so the backend can call the bot
via HTTP instead of spawning a subprocess. This gives clean container
separation: the backend never needs Playwright installed.

Endpoints:
  GET  /health   → {"status": "healthy", "busy": bool}
  POST /run      → RunResult (JSON, same schema as the old stdout output)

Only one Playwright session runs at a time (semaphore). Concurrent
requests receive HTTP 409 and should retry after the current run finishes.
"""
from __future__ import annotations

import asyncio
import logging
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from bot.src.bot import run_bot
from bot.src.config import BotConfig

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("mercacompra.bot.http")

app = FastAPI(title="MercaCompra Bot Service", version="1.0.0")

# Single browser session at a time
_lock = asyncio.Lock()


class ItemIn(BaseModel):
    product_id: str = ""
    product_name: str
    quantity: int = 1
    price: Optional[float] = None


class RunPayload(BaseModel):
    items: List[ItemIn]
    headless: bool = True
    mercadona_email: Optional[str] = None
    mercadona_password: Optional[str] = None


@app.get("/health")
async def health():
    return {"status": "healthy", "busy": _lock.locked()}


@app.post("/run")
async def run_endpoint(payload: RunPayload):
    if _lock.locked():
        raise HTTPException(
            status_code=409,
            detail="Bot is currently busy processing another run. Try again later.",
        )

    config = BotConfig(
        headless=payload.headless,
        mercadona_email=payload.mercadona_email or "",
        mercadona_password=payload.mercadona_password or "",
    )

    items = [
        {
            "product_id": item.product_id,
            "product_name": item.product_name,
            "quantity": item.quantity,
            "price": item.price,
        }
        for item in payload.items
    ]

    async with _lock:
        logger.info(f"Starting bot run: {len(items)} items, headless={config.headless}")
        result = await run_bot(items, config)
        logger.info(
            f"Bot run finished: {result.added_ok} ok, {result.not_found} not found, "
            f"{result.errors} errors, {result.duration_seconds:.1f}s"
        )

    return result.to_dict()
