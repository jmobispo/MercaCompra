from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.pantry import PantryItem
from app.models.shopping_list import ShoppingList
from app.schemas.pantry import PantryItemCreate, PantryItemUpdate, PantryItemRead


class PantryService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_for_user(self, user_id: int) -> list[PantryItemRead]:
        result = await self.db.execute(
            select(PantryItem)
            .where(PantryItem.user_id == user_id)
            .order_by(PantryItem.is_consumed, PantryItem.created_at.desc())
        )
        return [PantryItemRead.model_validate(item) for item in result.scalars().all()]

    async def create(self, user_id: int, data: PantryItemCreate) -> PantryItemRead:
        item = PantryItem(user_id=user_id, **data.model_dump())
        self.db.add(item)
        await self.db.commit()
        await self.db.refresh(item)
        return PantryItemRead.model_validate(item)

    async def update(self, user_id: int, item_id: int, data: PantryItemUpdate) -> PantryItemRead:
        result = await self.db.execute(
            select(PantryItem).where(PantryItem.id == item_id, PantryItem.user_id == user_id)
        )
        item = result.scalar_one_or_none()
        if not item:
            raise HTTPException(status_code=404, detail="Producto no encontrado en despensa")

        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(item, key, value)

        await self.db.commit()
        await self.db.refresh(item)
        return PantryItemRead.model_validate(item)

    async def delete(self, user_id: int, item_id: int) -> None:
        result = await self.db.execute(
            select(PantryItem).where(PantryItem.id == item_id, PantryItem.user_id == user_id)
        )
        item = result.scalar_one_or_none()
        if not item:
            raise HTTPException(status_code=404, detail="Producto no encontrado en despensa")
        await self.db.delete(item)
        await self.db.commit()

    async def from_list(self, user_id: int, list_id: int) -> list[PantryItemRead]:
        result = await self.db.execute(
            select(ShoppingList)
            .options(selectinload(ShoppingList.items))
            .where(ShoppingList.id == list_id, ShoppingList.user_id == user_id)
        )
        shopping_list = result.scalar_one_or_none()
        if not shopping_list:
            raise HTTPException(status_code=404, detail="Lista no encontrada")

        added: list[PantryItem] = []
        for list_item in shopping_list.items:
            pantry_item = PantryItem(
                user_id=user_id,
                name=list_item.product_name,
                product_id=list_item.product_id,
                quantity=float(list_item.quantity),
                unit=list_item.product_unit,
            )
            self.db.add(pantry_item)
            added.append(pantry_item)

        await self.db.commit()
        for item in added:
            await self.db.refresh(item)
        return [PantryItemRead.model_validate(item) for item in added]
