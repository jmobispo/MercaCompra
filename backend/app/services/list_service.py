from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select
from typing import List
from app.repositories.list_repo import ShoppingListRepository
from app.models.shopping_list import ShoppingList, ShoppingListItem
from app.schemas.shopping_list import (
    ShoppingListCreate, ShoppingListUpdate,
    ShoppingListRead, ShoppingListSummary,
    ShoppingListItemCreate, ShoppingListItemUpdate,
    ShoppingListItemRead,
)


class ListService:
    def __init__(self, db: AsyncSession):
        self.repo = ShoppingListRepository(db)

    async def get_lists(self, user_id: int) -> List[ShoppingListSummary]:
        lists = await self.repo.get_all_by_user(user_id)
        summaries = []
        for sl in lists:
            total = sum((i.product_price or 0) * i.quantity for i in sl.items)
            summaries.append(ShoppingListSummary(
                id=sl.id,
                name=sl.name,
                budget=sl.budget,
                is_archived=sl.is_archived,
                item_count=len(sl.items),
                total=round(total, 2),
                updated_at=sl.updated_at,
            ))
        return summaries

    async def get_list(self, list_id: int, user_id: int) -> ShoppingListRead:
        sl = await self.repo.get_by_id(list_id, user_id)
        if not sl:
            raise HTTPException(status_code=404, detail="Lista no encontrada")
        return ShoppingListRead.model_validate(sl)

    async def create_list(self, user_id: int, data: ShoppingListCreate) -> ShoppingListRead:
        sl = await self.repo.create(user_id=user_id, name=data.name, budget=data.budget)
        # Reload with items
        sl = await self.repo.get_by_id(sl.id, user_id)
        return ShoppingListRead.model_validate(sl)

    async def update_list(self, list_id: int, user_id: int, data: ShoppingListUpdate) -> ShoppingListRead:
        sl = await self.repo.get_by_id(list_id, user_id)
        if not sl:
            raise HTTPException(status_code=404, detail="Lista no encontrada")
        updates = data.model_dump(exclude_none=True)
        await self.repo.update(sl, **updates)
        sl = await self.repo.get_by_id(list_id, user_id)
        return ShoppingListRead.model_validate(sl)

    async def delete_list(self, list_id: int, user_id: int) -> None:
        sl = await self.repo.get_by_id(list_id, user_id)
        if not sl:
            raise HTTPException(status_code=404, detail="Lista no encontrada")
        await self.repo.delete(sl)

    async def duplicate_list(self, list_id: int, user_id: int) -> ShoppingListRead:
        sl = await self.repo.get_by_id(list_id, user_id)
        if not sl:
            raise HTTPException(status_code=404, detail="Lista no encontrada")
        new_name = f"{sl.name} (copia)"
        new_sl = await self.repo.duplicate(sl, new_name, user_id)
        new_sl = await self.repo.get_by_id(new_sl.id, user_id)
        return ShoppingListRead.model_validate(new_sl)

    # --- Items ---

    async def add_item(self, list_id: int, user_id: int, data: ShoppingListItemCreate) -> ShoppingListRead:
        sl = await self.repo.get_by_id(list_id, user_id)
        if not sl:
            raise HTTPException(status_code=404, detail="Lista no encontrada")

        existing = await self.repo.find_item_by_product(list_id, data.product_id)
        if existing:
            await self.repo.update_item(existing, quantity=existing.quantity + data.quantity)
        else:
            await self.repo.add_item(
                list_id=list_id,
                product_id=data.product_id,
                product_name=data.product_name,
                product_price=data.product_price,
                product_unit=data.product_unit,
                product_thumbnail=data.product_thumbnail,
                product_category=data.product_category,
                quantity=data.quantity,
                note=data.note,
            )
        sl = await self.repo.get_by_id(list_id, user_id)
        return ShoppingListRead.model_validate(sl)

    async def update_item(
        self, list_id: int, user_id: int, item_id: int, data: ShoppingListItemUpdate
    ) -> ShoppingListRead:
        sl = await self.repo.get_by_id(list_id, user_id)
        if not sl:
            raise HTTPException(status_code=404, detail="Lista no encontrada")
        item = await self.repo.get_item(item_id, list_id)
        if not item:
            raise HTTPException(status_code=404, detail="Producto no encontrado en la lista")

        updates = data.model_dump(exclude_none=True)

        # quantity=0 means remove
        if updates.get("quantity") == 0:
            await self.repo.delete_item(item)
        else:
            await self.repo.update_item(item, **updates)

        sl = await self.repo.get_by_id(list_id, user_id)
        return ShoppingListRead.model_validate(sl)

    async def remove_item(self, list_id: int, user_id: int, item_id: int) -> ShoppingListRead:
        sl = await self.repo.get_by_id(list_id, user_id)
        if not sl:
            raise HTTPException(status_code=404, detail="Lista no encontrada")
        item = await self.repo.get_item(item_id, list_id)
        if not item:
            raise HTTPException(status_code=404, detail="Producto no encontrado en la lista")
        await self.repo.delete_item(item)
        sl = await self.repo.get_by_id(list_id, user_id)
        return ShoppingListRead.model_validate(sl)
