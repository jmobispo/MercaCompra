import asyncio
import logging
from typing import Optional

import httpx
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.favorite import FavoriteProduct
from app.models.pantry import PantryItem
from app.models.recipe import Recipe
from app.models.shopping_list import ShoppingList
from app.schemas.dashboard import DashboardData, RecentListData, SystemStatusData
from app.services.spending_service import SpendingService

logger = logging.getLogger(__name__)


async def _check_bot(bot_url: str) -> bool:
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(f"{bot_url}/health")
            return resp.status_code == 200
    except Exception:
        return False


class DashboardService:
    def __init__(self, db: AsyncSession, settings):
        self.db = db
        self.settings = settings

    async def get_dashboard(self, user_id: int, postal_code: str) -> DashboardData:
        # Run independent queries concurrently
        metrics_task = SpendingService(self.db).get_metrics(user_id)
        bot_task = _check_bot(self.settings.BOT_API_URL)

        metrics, bot_available = await asyncio.gather(metrics_task, bot_task)

        # Active lists
        lists_result = await self.db.execute(
            select(ShoppingList)
            .options(selectinload(ShoppingList.items))
            .where(ShoppingList.user_id == user_id, ShoppingList.is_archived == False)
            .order_by(ShoppingList.updated_at.desc())
        )
        active_lists = lists_result.scalars().all()

        recent_list: Optional[RecentListData] = None
        if active_lists:
            sl = active_lists[0]
            total = sum((i.product_price or 0) * i.quantity for i in sl.items)
            recent_list = RecentListData(
                id=sl.id,
                name=sl.name,
                item_count=len(sl.items),
                total=round(total, 2),
                updated_at=sl.updated_at.isoformat(),
            )

        # Pantry count (active only)
        pantry_count = await self.db.scalar(
            select(func.count()).where(
                PantryItem.user_id == user_id,
                PantryItem.is_consumed == False,
            )
        ) or 0

        # Own recipe count
        recipe_count = await self.db.scalar(
            select(func.count()).where(Recipe.user_id == user_id)
        ) or 0

        # Favorite count
        fav_count = await self.db.scalar(
            select(func.count()).where(FavoriteProduct.user_id == user_id)
        ) or 0

        return DashboardData(
            weekly_spending=metrics.weekly_current,
            weekly_variation=metrics.weekly_variation,
            active_list_count=len(active_lists),
            total_pantry_items=pantry_count,
            recipe_count=recipe_count,
            favorite_count=fav_count,
            recent_list=recent_list,
            system_status=SystemStatusData(
                search_mode=self.settings.PRODUCT_SEARCH_MODE,
                ai_mode=self.settings.AI_MODE,
                postal_code=postal_code,
                bot_available=bot_available,
                demo_mode=getattr(self.settings, "DEMO_MODE", False),
            ),
        )
