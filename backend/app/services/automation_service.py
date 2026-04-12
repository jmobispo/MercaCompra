"""
Automation service: calls the bot HTTP service, stores result in DB.

Architecture: backend → POST http://bot:8001/run → Playwright bot
The bot runs as a separate container/process with its own Python environment
that has Playwright installed. The backend does NOT need Playwright.
"""
import logging
import asyncio
from datetime import datetime, timezone
from typing import Optional

import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from app.core.config import get_settings
from app.models.automation import AutomationRun
from app.models.shopping_list import ShoppingList
from app.schemas.automation import AutomationRunCreate, AutomationRunRead

logger = logging.getLogger(__name__)
settings = get_settings()


class AutomationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _get_list(self, list_id: int, user_id: int) -> ShoppingList:
        result = await self.db.execute(
            select(ShoppingList)
            .where(ShoppingList.id == list_id, ShoppingList.user_id == user_id)
            .options(selectinload(ShoppingList.items))
        )
        sl = result.scalar_one_or_none()
        if not sl:
            raise HTTPException(status_code=404, detail="Lista no encontrada")
        return sl

    async def create_run(self, user_id: int, data: AutomationRunCreate) -> AutomationRunRead:
        """Create a pending run record and kick off the bot call in the background."""
        sl = await self._get_list(data.shopping_list_id, user_id)

        if not sl.items:
            raise HTTPException(status_code=400, detail="La lista está vacía")

        run = AutomationRun(
            user_id=user_id,
            shopping_list_id=sl.id,
            status="pending",
            total_items=len(sl.items),
        )
        self.db.add(run)
        await self.db.flush()
        await self.db.refresh(run)

        items_payload = [
            {
                "product_id": item.product_id,
                "product_name": item.product_name,
                "quantity": item.quantity,
                "price": item.product_price,
            }
            for item in sl.items
        ]

        # Fire and forget — HTTP response returns immediately
        asyncio.create_task(
            self._call_bot(
                run_id=run.id,
                items=items_payload,
                headless=data.headless,
                mercadona_email=data.mercadona_email,
                mercadona_password=data.mercadona_password,
            )
        )

        return AutomationRunRead.model_validate(run)

    async def _call_bot(
        self,
        run_id: int,
        items: list,
        headless: bool,
        mercadona_email: Optional[str],
        mercadona_password: Optional[str],
    ) -> None:
        """
        POST to the bot HTTP service, wait for the result (up to BOT_TIMEOUT seconds),
        and persist outcomes in the AutomationRun row.
        """
        from app.db.session import AsyncSessionLocal

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(AutomationRun).where(AutomationRun.id == run_id)
            )
            run = result.scalar_one_or_none()
            if not run:
                return

            run.status = "running"
            run.started_at = datetime.now(timezone.utc)
            await db.commit()

            try:
                payload = {
                    "items": items,
                    "headless": headless,
                    "mercadona_email": mercadona_email,
                    "mercadona_password": mercadona_password,
                }

                # Timeout = BOT_TIMEOUT + 10s grace
                timeout = httpx.Timeout(settings.BOT_TIMEOUT + 10.0)

                async with httpx.AsyncClient(timeout=timeout) as client:
                    response = await client.post(
                        f"{settings.BOT_API_URL}/run",
                        json=payload,
                    )

                if response.status_code == 409:
                    raise RuntimeError(
                        "El bot está ocupado procesando otra ejecución. Inténtalo más tarde."
                    )
                if response.status_code != 200:
                    raise RuntimeError(
                        f"Bot service error {response.status_code}: {response.text[:300]}"
                    )

                bot_result = response.json()
                item_results = bot_result.get("item_results", [])

                run.status = "completed"
                run.item_results = item_results
                run.added_ok = sum(1 for r in item_results if r.get("status") == "ok")
                run.not_found = sum(1 for r in item_results if r.get("status") == "not_found")
                run.dubious_match = sum(1 for r in item_results if r.get("status") == "dubious")
                run.substituted = sum(1 for r in item_results if r.get("status") == "substituted")
                run.errors = sum(1 for r in item_results if r.get("status") == "error")
                run.estimated_cost = bot_result.get("estimated_cost")
                run.duration_seconds = bot_result.get("duration_seconds")

            except httpx.ConnectError:
                run.status = "failed"
                run.error_message = (
                    "No se pudo conectar con el servicio bot. "
                    "Asegúrate de que el bot está en marcha (BOT_API_URL=%s)."
                    % settings.BOT_API_URL
                )
                logger.error(f"Run {run_id}: bot service unreachable at {settings.BOT_API_URL}")

            except httpx.TimeoutException:
                run.status = "failed"
                run.error_message = f"Bot timeout (>{settings.BOT_TIMEOUT}s)"
                logger.error(f"Run {run_id}: bot timed out after {settings.BOT_TIMEOUT}s")

            except Exception as e:
                run.status = "failed"
                run.error_message = str(e)[:500]
                logger.error(f"Run {run_id} failed: {e}", exc_info=True)

            finally:
                run.finished_at = datetime.now(timezone.utc)
                await db.commit()

    async def get_run(self, run_id: int, user_id: int) -> AutomationRunRead:
        result = await self.db.execute(
            select(AutomationRun).where(
                AutomationRun.id == run_id,
                AutomationRun.user_id == user_id,
            )
        )
        run = result.scalar_one_or_none()
        if not run:
            raise HTTPException(status_code=404, detail="Ejecución no encontrada")
        return AutomationRunRead.model_validate(run)

    async def get_runs_for_user(self, user_id: int, limit: int = 10) -> list:
        result = await self.db.execute(
            select(AutomationRun)
            .where(AutomationRun.user_id == user_id)
            .order_by(AutomationRun.created_at.desc())
            .limit(limit)
        )
        runs = result.scalars().all()
        return [AutomationRunRead.model_validate(r) for r in runs]
