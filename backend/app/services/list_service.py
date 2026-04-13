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
from app.services.habit_service import HabitService


class ListService:
    def __init__(self, db: AsyncSession):
        self.repo = ShoppingListRepository(db)
        self.db = db

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

    async def create_list_entity(self, user_id: int, name: str, budget: float | None) -> ShoppingList:
        return await self.repo.create(user_id=user_id, name=name, budget=budget)

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
        await HabitService(self.db).record_additions(
            user_id,
            [
                {
                    "product_id": item.product_id,
                    "product_name": item.product_name,
                    "product_price": item.product_price,
                    "product_unit": item.product_unit,
                    "product_thumbnail": item.product_thumbnail,
                    "product_category": item.product_category,
                    "quantity": item.quantity,
                    "source": "duplicate_list",
                }
                for item in sl.items
            ],
        )
        new_sl = await self.repo.get_by_id(new_sl.id, user_id)
        return ShoppingListRead.model_validate(new_sl)

    # --- Items ---

    async def add_item(self, list_id: int, user_id: int, data: ShoppingListItemCreate) -> ShoppingListRead:
        sl = await self.add_item_entity(list_id, user_id, data.model_dump(), record_habit=True)
        return ShoppingListRead.model_validate(sl)

    async def add_item_entity(
        self,
        list_id: int,
        user_id: int,
        data: dict,
        record_habit: bool = True,
    ) -> ShoppingList:
        sl = await self.repo.get_by_id(list_id, user_id)
        if not sl:
            raise HTTPException(status_code=404, detail="Lista no encontrada")

        product_id = data["product_id"]
        existing = await self.repo.find_item_by_product(list_id, product_id)
        if existing:
            await self.repo.update_item(existing, quantity=existing.quantity + int(data.get("quantity", 1)))
        else:
            await self.repo.add_item(
                list_id=list_id,
                product_id=product_id,
                product_name=data["product_name"],
                product_price=data.get("product_price"),
                product_unit=data.get("product_unit"),
                product_thumbnail=data.get("product_thumbnail"),
                product_category=data.get("product_category"),
                quantity=int(data.get("quantity", 1)),
                note=data.get("note"),
            )
        if record_habit:
            await HabitService(self.db).record_additions(
                user_id,
                [
                    {
                        "product_id": product_id,
                        "product_name": data["product_name"],
                        "product_price": data.get("product_price"),
                        "product_unit": data.get("product_unit"),
                        "product_thumbnail": data.get("product_thumbnail"),
                        "product_category": data.get("product_category"),
                        "quantity": int(data.get("quantity", 1)),
                        "source": data.get("source") or "manual",
                    }
                ],
            )
        sl = await self.repo.get_by_id(list_id, user_id)
        if not sl:
            raise HTTPException(status_code=404, detail="Lista no encontrada")
        return sl

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

    async def get_list_entity(self, list_id: int, user_id: int) -> ShoppingList:
        sl = await self.repo.get_by_id(list_id, user_id)
        if not sl:
            raise HTTPException(status_code=404, detail="Lista no encontrada")
        return sl

    async def optimize_list_preview(self, list_id: int, user_id: int) -> dict:
        sl = await self.get_list_entity(list_id, user_id)
        suggestions = self._build_optimization_suggestions(sl.items)
        return {
            "list_id": sl.id,
            "list_name": sl.name,
            "total_items": len(sl.items),
            "total_suggestions": len(suggestions),
            "suggestions": suggestions,
        }

    async def apply_optimization(self, list_id: int, user_id: int, suggestion_ids: list[str]) -> ShoppingListRead:
        sl = await self.get_list_entity(list_id, user_id)
        suggestion_map = {
            suggestion["id"]: suggestion
            for suggestion in self._build_optimization_suggestions(sl.items)
        }
        if not suggestion_ids:
            return ShoppingListRead.model_validate(sl)

        for suggestion_id in suggestion_ids:
            suggestion = suggestion_map.get(suggestion_id)
            if not suggestion:
                continue
            items = [item for item in sl.items if item.id in suggestion["item_ids"]]
            if len(items) < 2:
                continue
            keeper = items[0]
            keeper.quantity = suggestion["combined_quantity"]
            keeper.product_name = suggestion["merged_product_name"]
            keeper.note = suggestion["merged_note"]
            if suggestion["product_price"] is not None:
                keeper.product_price = suggestion["product_price"]
            if suggestion["product_thumbnail"]:
                keeper.product_thumbnail = suggestion["product_thumbnail"]
            if suggestion["product_category"]:
                keeper.product_category = suggestion["product_category"]
            if suggestion["product_unit"]:
                keeper.product_unit = suggestion["product_unit"]
            for extra in items[1:]:
                await self.repo.delete_item(extra)

        sl = await self.repo.get_by_id(list_id, user_id)
        if not sl:
            raise HTTPException(status_code=404, detail="Lista no encontrada")
        return ShoppingListRead.model_validate(sl)

    def _build_optimization_suggestions(self, items: list[ShoppingListItem]) -> list[dict]:
        groups: dict[str, list[ShoppingListItem]] = {}

        for item in items:
            normalized = self._normalize_name(item.product_name)
            if item.product_id.startswith("recipe_") or item.product_id.startswith("weekly_"):
                key = f"name:{normalized}"
            else:
                key = f"product:{item.product_id}"
            groups.setdefault(key, []).append(item)

        suggestions: list[dict] = []
        for key, group in groups.items():
            if len(group) < 2:
                continue

            keeper = sorted(group, key=lambda item: (-item.quantity, item.id))[0]
            combined_quantity = sum(item.quantity for item in group)
            merged_note = " | ".join(
                note for note in dict.fromkeys(item.note for item in group if item.note)
            ) or None
            reason = "Duplicados exactos" if key.startswith("product:") else "Productos muy parecidos por nombre"
            suggestions.append(
                {
                    "id": f"merge-{'-'.join(str(item.id) for item in sorted(group, key=lambda item: item.id))}",
                    "reason": reason,
                    "item_ids": [item.id for item in group],
                    "item_names": [item.product_name for item in group],
                    "merged_product_name": keeper.product_name,
                    "combined_quantity": combined_quantity,
                    "product_price": keeper.product_price,
                    "product_unit": keeper.product_unit,
                    "product_thumbnail": keeper.product_thumbnail,
                    "product_category": keeper.product_category,
                    "merged_note": merged_note,
                }
            )

        return suggestions

    @staticmethod
    def _normalize_name(value: str) -> str:
        import unicodedata

        normalized = unicodedata.normalize("NFKD", value or "")
        plain = "".join(char for char in normalized if not unicodedata.combining(char))
        return " ".join(plain.lower().strip().split())
