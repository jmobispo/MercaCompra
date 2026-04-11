"""
Automation service: bridges backend and bot.
Launches automation run, stores result.
"""
import logging
import asyncio
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException

from app.models.automation import AutomationRun
from app.models.shopping_list import ShoppingList
from sqlalchemy.orm import selectinload
from app.schemas.automation import AutomationRunCreate, AutomationRunRead

logger = logging.getLogger(__name__)


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
        """Create a new automation run record and launch bot asynchronously."""
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

        # Prepare items payload for bot
        items_payload = [
            {
                "product_id": item.product_id,
                "product_name": item.product_name,
                "quantity": item.quantity,
                "price": item.product_price,
            }
            for item in sl.items
        ]

        # Launch bot in background (non-blocking for the HTTP response)
        asyncio.create_task(
            self._run_bot(
                run_id=run.id,
                items=items_payload,
                headless=data.headless,
                mercadona_email=data.mercadona_email,
                mercadona_password=data.mercadona_password,
            )
        )

        return AutomationRunRead.model_validate(run)

    async def _run_bot(
        self,
        run_id: int,
        items: list,
        headless: bool,
        mercadona_email: Optional[str],
        mercadona_password: Optional[str],
    ) -> None:
        """
        Execute the Playwright bot in a subprocess.
        Updates AutomationRun with results.
        """
        from app.db.session import AsyncSessionLocal
        import json, subprocess, sys
        from pathlib import Path

        bot_script = Path(__file__).parent.parent.parent.parent / "bot" / "src" / "bot.py"

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(AutomationRun).where(AutomationRun.id == run_id))
            run = result.scalar_one_or_none()
            if not run:
                return

            run.status = "running"
            run.started_at = datetime.now(timezone.utc)
            await db.commit()

            try:
                env_vars = {"HEADLESS": "true" if headless else "false"}
                if mercadona_email:
                    env_vars["MERCADONA_EMAIL"] = mercadona_email
                if mercadona_password:
                    env_vars["MERCADONA_PASSWORD"] = mercadona_password

                proc = await asyncio.create_subprocess_exec(
                    sys.executable, str(bot_script),
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    env={**__import__("os").environ, **env_vars},
                )

                input_data = json.dumps({"items": items}).encode()
                stdout, stderr = await asyncio.wait_for(
                    proc.communicate(input=input_data),
                    timeout=300,
                )

                if proc.returncode != 0:
                    raise RuntimeError(f"Bot exited with code {proc.returncode}: {stderr.decode()[:500]}")

                bot_result = json.loads(stdout.decode())
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

            except asyncio.TimeoutError:
                run.status = "failed"
                run.error_message = "Bot timeout (>300s)"
                logger.error(f"Automation run {run_id} timed out")
            except Exception as e:
                run.status = "failed"
                run.error_message = str(e)[:500]
                logger.error(f"Automation run {run_id} failed: {e}")
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
