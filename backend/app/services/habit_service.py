from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.habit import UserProductStats
from app.models.shopping_list import ShoppingList
from app.schemas.habit import FrequentProductRead


class HabitService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def record_additions(self, user_id: int, products: list[dict[str, Any]]) -> None:
        now = datetime.now(timezone.utc)
        for product in products:
            product_id = str(product.get("product_id") or "").strip()
            product_name = (product.get("product_name") or "").strip()
            if not product_id or not product_name:
                continue

            quantity = float(product.get("quantity") or 1)
            result = await self.db.execute(
                select(UserProductStats).where(
                    UserProductStats.user_id == user_id,
                    UserProductStats.product_id == product_id,
                )
            )
            stats = result.scalar_one_or_none()

            if stats:
                total_quantity = (stats.average_quantity * stats.times_added) + quantity
                stats.times_added += 1
                stats.average_quantity = round(total_quantity / stats.times_added, 2)
                stats.last_added_at = now
                stats.product_name = product_name
                stats.product_price = product.get("product_price")
                stats.product_unit = product.get("product_unit")
                stats.product_thumbnail = product.get("product_thumbnail")
                stats.product_category = product.get("product_category")
                stats.source = product.get("source") or stats.source
            else:
                stats = UserProductStats(
                    user_id=user_id,
                    product_id=product_id,
                    product_name=product_name,
                    product_price=product.get("product_price"),
                    product_unit=product.get("product_unit"),
                    product_thumbnail=product.get("product_thumbnail"),
                    product_category=product.get("product_category"),
                    source=product.get("source") or "manual",
                    times_added=1,
                    last_added_at=now,
                    average_quantity=quantity,
                )
                self.db.add(stats)

        await self.db.flush()

    async def get_frequent_products(self, user_id: int, limit: int = 12) -> list[FrequentProductRead]:
        result = await self.db.execute(
            select(UserProductStats)
            .where(UserProductStats.user_id == user_id)
            .order_by(UserProductStats.times_added.desc(), UserProductStats.last_added_at.desc())
            .limit(limit)
        )
        stats = result.scalars().all()
        return [FrequentProductRead.model_validate(item) for item in stats]

    async def add_frequent_products_to_list(
        self,
        user_id: int,
        limit: int = 6,
        list_id: int | None = None,
        new_list_name: str | None = None,
    ) -> ShoppingList:
        from app.services.list_service import ListService

        frequent_products = await self.get_frequent_products(user_id, limit=limit)
        if not frequent_products:
            raise HTTPException(status_code=400, detail="Todavia no hay habitos suficientes")

        list_service = ListService(self.db)
        if list_id is not None:
            shopping_list = await list_service.get_list_entity(list_id, user_id)
        else:
            shopping_list = await list_service.create_list_entity(
                user_id=user_id,
                name=new_list_name or "Tus basicos",
                budget=None,
            )

        for item in frequent_products:
            await list_service.add_item_entity(
                shopping_list.id,
                user_id,
                {
                    "product_id": item.product_id,
                    "product_name": item.product_name,
                    "product_price": item.product_price,
                    "product_unit": item.product_unit,
                    "product_thumbnail": item.product_thumbnail,
                    "product_category": item.product_category,
                    "quantity": max(1, round(item.average_quantity)),
                    "note": "Anadido desde tus basicos",
                    "source": item.source,
                },
                record_habit=False,
            )

        refreshed = await list_service.get_list_entity(shopping_list.id, user_id)
        if refreshed is None:
            raise HTTPException(status_code=404, detail="Lista no encontrada")
        return refreshed
