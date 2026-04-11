from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import Optional, List
from app.models.shopping_list import ShoppingList, ShoppingListItem
from datetime import datetime, timezone


class ShoppingListRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_all_by_user(self, user_id: int) -> List[ShoppingList]:
        result = await self.db.execute(
            select(ShoppingList)
            .where(ShoppingList.user_id == user_id, ShoppingList.is_archived == False)
            .options(selectinload(ShoppingList.items))
            .order_by(ShoppingList.updated_at.desc())
        )
        return list(result.scalars().all())

    async def get_by_id(self, list_id: int, user_id: int) -> Optional[ShoppingList]:
        result = await self.db.execute(
            select(ShoppingList)
            .where(ShoppingList.id == list_id, ShoppingList.user_id == user_id)
            .options(selectinload(ShoppingList.items))
        )
        return result.scalar_one_or_none()

    async def create(self, user_id: int, name: str, budget: Optional[float] = None) -> ShoppingList:
        sl = ShoppingList(user_id=user_id, name=name, budget=budget)
        self.db.add(sl)
        await self.db.flush()
        await self.db.refresh(sl)
        return sl

    async def update(self, sl: ShoppingList, **kwargs) -> ShoppingList:
        for key, value in kwargs.items():
            setattr(sl, key, value)
        sl.updated_at = datetime.now(timezone.utc)
        await self.db.flush()
        await self.db.refresh(sl)
        return sl

    async def delete(self, sl: ShoppingList) -> None:
        await self.db.delete(sl)
        await self.db.flush()

    async def duplicate(self, sl: ShoppingList, new_name: str, user_id: int) -> ShoppingList:
        new_sl = ShoppingList(user_id=user_id, name=new_name, budget=sl.budget)
        self.db.add(new_sl)
        await self.db.flush()
        await self.db.refresh(new_sl)

        # Clone items
        result = await self.db.execute(
            select(ShoppingListItem).where(ShoppingListItem.shopping_list_id == sl.id)
        )
        for item in result.scalars().all():
            new_item = ShoppingListItem(
                shopping_list_id=new_sl.id,
                product_id=item.product_id,
                product_name=item.product_name,
                product_price=item.product_price,
                product_unit=item.product_unit,
                product_thumbnail=item.product_thumbnail,
                product_category=item.product_category,
                quantity=item.quantity,
                is_checked=False,
            )
            self.db.add(new_item)
        await self.db.flush()
        return new_sl

    # --- Items ---

    async def get_item(self, item_id: int, list_id: int) -> Optional[ShoppingListItem]:
        result = await self.db.execute(
            select(ShoppingListItem).where(
                ShoppingListItem.id == item_id,
                ShoppingListItem.shopping_list_id == list_id,
            )
        )
        return result.scalar_one_or_none()

    async def find_item_by_product(self, list_id: int, product_id: str) -> Optional[ShoppingListItem]:
        result = await self.db.execute(
            select(ShoppingListItem).where(
                ShoppingListItem.shopping_list_id == list_id,
                ShoppingListItem.product_id == product_id,
            )
        )
        return result.scalar_one_or_none()

    async def add_item(self, list_id: int, **kwargs) -> ShoppingListItem:
        item = ShoppingListItem(shopping_list_id=list_id, **kwargs)
        self.db.add(item)
        await self.db.flush()
        await self.db.refresh(item)
        return item

    async def update_item(self, item: ShoppingListItem, **kwargs) -> ShoppingListItem:
        for key, value in kwargs.items():
            setattr(item, key, value)
        await self.db.flush()
        await self.db.refresh(item)
        return item

    async def delete_item(self, item: ShoppingListItem) -> None:
        await self.db.delete(item)
        await self.db.flush()
