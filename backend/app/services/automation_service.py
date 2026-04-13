"""
Automation service: calls the bot HTTP service and stores the result in DB.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

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
        shopping_list = result.scalar_one_or_none()
        if not shopping_list:
            raise HTTPException(status_code=404, detail="Lista no encontrada")
        return shopping_list

    def _mark_failed(self, run: AutomationRun, message: str) -> None:
        run.status = "failed"
        run.error_message = message[:500]
        run.finished_at = datetime.now(timezone.utc)

    async def create_run(
        self,
        user_id: int,
        data: AutomationRunCreate,
        postal_code: Optional[str] = None,
    ) -> AutomationRunRead:
        shopping_list = await self._get_list(data.shopping_list_id, user_id)

        if not shopping_list.items:
            raise HTTPException(status_code=400, detail="La lista está vacía")

        run = AutomationRun(
            user_id=user_id,
            shopping_list_id=shopping_list.id,
            status="pending",
            total_items=len(shopping_list.items),
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
            for item in shopping_list.items
        ]

        asyncio.create_task(
            self._call_bot(
                run_id=run.id,
                items=items_payload,
                headless=data.headless,
                mercadona_email=data.mercadona_email,
                mercadona_password=data.mercadona_password,
                postal_code=postal_code,
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
        postal_code: Optional[str],
    ) -> None:
        from app.db.session import AsyncSessionLocal

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(AutomationRun).where(AutomationRun.id == run_id))
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
                    "postal_code": postal_code,
                }

                timeout = httpx.Timeout(settings.BOT_TIMEOUT + 10.0)
                async with httpx.AsyncClient(timeout=timeout) as client:
                    response = await client.post(f"{settings.BOT_API_URL}/run", json=payload)

                if response.status_code == 409:
                    raise RuntimeError("El bot está ocupado procesando otra ejecución. Inténtalo más tarde.")
                if response.status_code == 504:
                    raise RuntimeError("La automatización del bot excedió el tiempo máximo y fue cancelada.")
                if response.status_code != 200:
                    raise RuntimeError(
                        f"Bot service error {response.status_code}: {response.text[:300]}"
                    )

                bot_result = response.json()
                item_results = bot_result.get("item_results", [])

                run.status = "completed"
                run.item_results = item_results
                run.added_ok = sum(1 for item in item_results if item.get("status") == "ok")
                run.not_found = sum(1 for item in item_results if item.get("status") == "not_found")
                run.dubious_match = sum(1 for item in item_results if item.get("status") == "dubious")
                run.substituted = sum(1 for item in item_results if item.get("status") == "substituted")
                run.errors = sum(1 for item in item_results if item.get("status") == "error")
                run.estimated_cost = bot_result.get("estimated_cost")
                run.duration_seconds = bot_result.get("duration_seconds")

                if bot_result.get("error_message"):
                    run.status = "partial" if item_results else "failed"
                    run.error_message = str(bot_result.get("error_message"))[:500]

            except httpx.ConnectError:
                self._mark_failed(
                    run,
                    (
                        "No se pudo conectar con el servicio bot. "
                        f"Asegúrate de que el bot está en marcha (BOT_API_URL={settings.BOT_API_URL})."
                    ),
                )
                logger.error("Run %s: bot service unreachable at %s", run_id, settings.BOT_API_URL)

            except httpx.TimeoutException:
                self._mark_failed(run, f"Bot timeout (>{settings.BOT_TIMEOUT}s)")
                logger.error("Run %s: bot timed out after %ss", run_id, settings.BOT_TIMEOUT)

            except Exception as exc:
                self._mark_failed(run, str(exc))
                logger.error("Run %s failed: %s", run_id, exc, exc_info=True)

            finally:
                if run.finished_at is None:
                    run.finished_at = datetime.now(timezone.utc)
                await db.commit()

    async def _mark_stale_runs(self, user_id: int) -> None:
        stale_before = datetime.now(timezone.utc) - timedelta(seconds=settings.BOT_TIMEOUT + 30)
        result = await self.db.execute(
            select(AutomationRun).where(
                AutomationRun.user_id == user_id,
                AutomationRun.status.in_(["pending", "running"]),
                AutomationRun.started_at.is_not(None),
                AutomationRun.started_at < stale_before,
            )
        )
        stale_runs = result.scalars().all()
        if not stale_runs:
            return

        for run in stale_runs:
            self._mark_failed(
                run,
                "La ejecución anterior quedó bloqueada y se marcó como fallida por timeout.",
            )
        await self.db.commit()

    async def get_run(self, run_id: int, user_id: int) -> AutomationRunRead:
        await self._mark_stale_runs(user_id)
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
        await self._mark_stale_runs(user_id)
        result = await self.db.execute(
            select(AutomationRun)
            .where(AutomationRun.user_id == user_id)
            .order_by(AutomationRun.created_at.desc())
            .limit(limit)
        )
        runs = result.scalars().all()
        return [AutomationRunRead.model_validate(run) for run in runs]
