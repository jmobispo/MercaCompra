import math
import re
import unicodedata
from difflib import SequenceMatcher
from typing import List

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.pantry import PantryItem
from app.repositories.list_repo import ShoppingListRepository
from app.models.shopping_list import ShoppingList, ShoppingListItem
from app.schemas.shopping_list import (
    ShoppingListCreate, ShoppingListUpdate,
    ShoppingListRead, ShoppingListSummary,
    ShoppingListItemCreate, ShoppingListItemUpdate,
    ShoppingListItemRead,
)
from app.services.habit_service import HabitService
from app.services.pantry_support import (
    convert_amount,
    normalize_text,
    normalize_unit,
    pantry_total_in_unit,
    parse_measurement_text,
    units_compatible,
)


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

    async def optimize_list_preview(self, list_id: int, user_id: int, include_fuzzy: bool = True) -> dict:
        sl = await self.get_list_entity(list_id, user_id)
        pantry_items = await self._get_active_pantry_items(user_id)
        suggestions = self._build_optimization_suggestions(sl.items, pantry_items, include_fuzzy=include_fuzzy)
        return {
            "list_id": sl.id,
            "list_name": sl.name,
            "total_items": len(sl.items),
            "total_suggestions": len(suggestions),
            "suggestions": suggestions,
        }

    async def apply_optimization(
        self,
        list_id: int,
        user_id: int,
        suggestion_ids: list[str],
        include_fuzzy: bool = True,
    ) -> ShoppingListRead:
        sl = await self.get_list_entity(list_id, user_id)
        pantry_items = await self._get_active_pantry_items(user_id)
        suggestion_map = {
            suggestion["id"]: suggestion
            for suggestion in self._build_optimization_suggestions(sl.items, pantry_items, include_fuzzy=include_fuzzy)
        }
        if not suggestion_ids:
            return ShoppingListRead.model_validate(sl)

        for suggestion_id in suggestion_ids:
            suggestion = suggestion_map.get(suggestion_id)
            if not suggestion:
                continue
            items = [item for item in sl.items if item.id in suggestion["item_ids"]]
            if not items:
                continue
            keeper = items[0]
            if suggestion["combined_quantity"] <= 0:
                await self.repo.delete_item(keeper)
                if len(items) > 1:
                    for extra in items[1:]:
                        await self.repo.delete_item(extra)
                continue
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
            if len(items) > 1:
                for extra in items[1:]:
                    await self.repo.delete_item(extra)

        sl = await self.repo.get_by_id(list_id, user_id)
        if not sl:
            raise HTTPException(status_code=404, detail="Lista no encontrada")
        return ShoppingListRead.model_validate(sl)

    async def _get_active_pantry_items(self, user_id: int) -> list[PantryItem]:
        result = await self.db.execute(
            select(PantryItem).where(
                PantryItem.user_id == user_id,
                PantryItem.is_consumed == False,
            )
        )
        return list(result.scalars().all())

    def _build_optimization_suggestions(
        self,
        items: list[ShoppingListItem],
        pantry_items: list[PantryItem] | None = None,
        include_fuzzy: bool = True,
    ) -> list[dict]:
        groups: dict[str, list[ShoppingListItem]] = {}
        suggestions: list[dict] = []
        seen_groups: set[tuple[int, ...]] = set()
        pantry_items = pantry_items or []

        for suggestion in self._build_pantry_coverage_suggestions(items, pantry_items):
            suggestions.append(suggestion)
            seen_groups.add(tuple(sorted(suggestion["item_ids"])))

        for suggestion in self._build_quantity_rightsizing_suggestions(items):
            suggestions.append(suggestion)
            seen_groups.add(tuple(sorted(suggestion["item_ids"])))

        for item in items:
            normalized = self._normalize_name(item.product_name)
            product_id = str(item.product_id or "")
            if product_id.startswith("recipe_") or product_id.startswith("weekly_"):
                key = f"name:{normalized}"
            else:
                key = f"product:{product_id}"
            groups.setdefault(key, []).append(item)

        for key, group in groups.items():
            if len(group) < 2:
                continue

            reason = "Duplicados exactos" if key.startswith("product:") else "Productos muy parecidos por nombre"
            suggestion = self._build_group_suggestion(group, reason)
            if suggestion:
                suggestions.append(suggestion)
                seen_groups.add(tuple(sorted(suggestion["item_ids"])))

        if include_fuzzy:
            fuzzy_groups = self._build_fuzzy_groups(items)
            for group, reason in fuzzy_groups:
                ids_key = tuple(sorted(item.id for item in group))
                if len(ids_key) < 2 or ids_key in seen_groups:
                    continue
                suggestion = self._build_group_suggestion(group, reason)
                if suggestion:
                    suggestions.append(suggestion)
                    seen_groups.add(ids_key)

        return suggestions

    def _build_pantry_coverage_suggestions(
        self,
        items: list[ShoppingListItem],
        pantry_items: list[PantryItem],
    ) -> list[dict]:
        if not pantry_items:
            return []

        suggestions: list[dict] = []
        for item in items:
            if item.is_checked or item.quantity <= 0 or not item.product_unit:
                continue

            pack = self._parse_pack_size(item.product_unit)
            if not pack:
                continue

            pack_amount, pack_unit = pack
            baseline_qty = self._infer_reasonable_quantity(item) or item.quantity
            total_required = baseline_qty * pack_amount
            pantry_available = pantry_total_in_unit(
                pantry_items,
                product_id=item.product_id,
                product_name=item.product_name,
                ingredient_name=item.product_name,
                target_unit=pack_unit,
            )

            remaining = max(0.0, total_required - pantry_available)
            if remaining <= 0:
                recommended = 0
            else:
                recommended = max(1, math.ceil(remaining / pack_amount))

            if recommended >= item.quantity:
                continue

            suggestions.append(
                {
                    "id": f"pantry-{item.id}",
                    "reason": (
                        "Ya lo tienes cubierto en despensa"
                        if recommended == 0
                        else "La despensa cubre parte de este producto"
                    ),
                    "item_ids": [item.id],
                    "item_names": [item.product_name],
                    "merged_product_name": item.product_name,
                    "combined_quantity": recommended,
                    "product_price": item.product_price,
                    "product_unit": item.product_unit,
                    "product_thumbnail": item.product_thumbnail,
                    "product_category": item.product_category,
                    "merged_note": item.note,
                }
            )

        return suggestions

    def _build_quantity_rightsizing_suggestions(self, items: list[ShoppingListItem]) -> list[dict]:
        suggestions: list[dict] = []
        for item in items:
            recommended = self._infer_reasonable_quantity(item)
            if recommended is None or recommended >= item.quantity:
                continue
            suggestions.append(
                {
                    "id": f"resize-{item.id}",
                    "reason": "Cantidad probablemente sobredimensionada segun recetas y tamano del pack",
                    "item_ids": [item.id],
                    "item_names": [item.product_name],
                    "merged_product_name": item.product_name,
                    "combined_quantity": recommended,
                    "product_price": item.product_price,
                    "product_unit": item.product_unit,
                    "product_thumbnail": item.product_thumbnail,
                    "product_category": item.product_category,
                    "merged_note": item.note,
                }
            )
        return suggestions

    def _build_fuzzy_groups(self, items: list[ShoppingListItem]) -> list[tuple[list[ShoppingListItem], str]]:
        groups: list[tuple[list[ShoppingListItem], str]] = []
        consumed: set[int] = set()

        comparable = [item for item in items if not item.is_checked]

        for item in comparable:
            if item.id in consumed:
                continue

            current_group = [item]
            current_reason: str | None = None

            for other in comparable:
                if other.id == item.id or other.id in consumed:
                    continue

                reason = self._match_reason(item, other)
                if reason:
                    current_group.append(other)
                    current_reason = current_reason or reason

            if len(current_group) >= 2 and current_reason:
                groups.append((current_group, current_reason))
                consumed.update(member.id for member in current_group)

        return groups

    def _match_reason(self, left: ShoppingListItem, right: ShoppingListItem) -> str | None:
        left_name = self._normalize_name(left.product_name)
        right_name = self._normalize_name(right.product_name)
        if not left_name or not right_name or left_name == right_name:
            return None

        left_tokens = self._name_tokens(left.product_name)
        right_tokens = self._name_tokens(right.product_name)
        if not left_tokens or not right_tokens:
            return None

        intersection = left_tokens & right_tokens
        overlap = len(intersection) / max(min(len(left_tokens), len(right_tokens)), 1)
        similarity = SequenceMatcher(None, left_name, right_name).ratio()

        same_category = bool(left.product_category and right.product_category and left.product_category == right.product_category)
        same_unit = bool(left.product_unit and right.product_unit and left.product_unit == right.product_unit)

        if same_category and same_unit and overlap >= 0.6:
            return "Variantes muy parecidas en la misma categoría"
        if same_category and similarity >= 0.82:
            return "Nombres casi duplicados en la misma categoría"
        if overlap >= 0.75 and similarity >= 0.72:
            return "Posible duplicado por nombre parecido"

        return None

    def _build_group_suggestion(self, group: list[ShoppingListItem], reason: str) -> dict | None:
        if len(group) < 2:
            return None

        ordered = sorted(group, key=lambda item: (-item.quantity, item.id))
        keeper = ordered[0]
        combined_quantity = sum(item.quantity for item in ordered)
        merged_note = " | ".join(
            note for note in dict.fromkeys(item.note for item in ordered if item.note)
        ) or None
        return {
            "id": f"merge-{'-'.join(str(item.id) for item in sorted(ordered, key=lambda item: item.id))}",
            "reason": reason,
            "item_ids": [item.id for item in ordered],
            "item_names": [item.product_name for item in ordered],
            "merged_product_name": keeper.product_name,
            "combined_quantity": combined_quantity,
            "product_price": keeper.product_price,
            "product_unit": keeper.product_unit,
            "product_thumbnail": keeper.product_thumbnail,
            "product_category": keeper.product_category,
            "merged_note": merged_note,
        }

    @staticmethod
    def _normalize_name(value: str) -> str:
        normalized = unicodedata.normalize("NFKD", value or "")
        plain = "".join(char for char in normalized if not unicodedata.combining(char))
        return " ".join(plain.lower().strip().split())

    def _infer_reasonable_quantity(self, item: ShoppingListItem) -> int | None:
        if item.quantity <= 1 or not item.note or not item.product_unit:
            return None

        pack = self._parse_pack_size(item.product_unit)
        if not pack:
            return None

        pack_amount, pack_unit = pack
        note_amounts = self._parse_recipe_amounts(item.note)
        if self._is_staple_item(item) and (note_amounts or "al gusto" in self._normalize_name(item.note)):
            return 1

        if note_amounts and pack_unit in {"kg", "g", "l", "ml"}:
            discrete_totals = []
            cooking_measure_seen = False
            for amount, unit in note_amounts:
                normalized_unit = self._normalize_unit(unit)
                if normalized_unit == "uds":
                    discrete_totals.append(amount)
                elif self._is_cooking_measure(normalized_unit):
                    cooking_measure_seen = True

            if cooking_measure_seen and self._is_staple_item(item):
                return 1

            if discrete_totals and self._is_packaged_weight_item(item):
                guessed_pack_units = self._guess_units_per_pack(item)
                if guessed_pack_units:
                    return max(1, math.ceil(sum(discrete_totals) / guessed_pack_units))
                return 1

        if not note_amounts:
            return None

        compatible_totals = []
        discrete_fallback_total = 0.0

        for amount, unit in note_amounts:
            normalized_unit = self._normalize_unit(unit)
            if self._units_compatible(pack_unit, normalized_unit):
                converted = self._convert_amount(amount, normalized_unit, pack_unit)
                if converted is not None:
                    compatible_totals.append(converted)
            elif pack_unit in {"kg", "g", "l", "ml"} and normalized_unit in {"ud", "uds", "unidad", "unidades"} and amount < 1:
                discrete_fallback_total += amount

        if compatible_totals:
            total_required_in_pack_unit = sum(compatible_totals)
            recommended = max(1, math.ceil(total_required_in_pack_unit / pack_amount))
            return recommended

        if discrete_fallback_total > 0:
            return max(1, math.ceil(discrete_fallback_total))

        return None

    def _is_staple_item(self, item: ShoppingListItem) -> bool:
        haystack = self._normalize_name(f"{item.product_name} {item.product_category or ''}")
        keywords = {
            "aceite", "sal", "pimienta", "especia", "especias", "oregano", "oregano",
            "comino", "curry", "pimenton", "pimenton", "ajo granulado", "salsa soja",
            "vinagre", "azucar", "harina", "pan rallado", "caldo", "mayonesa",
            "ketchup", "mostaza",
        }
        return any(keyword in haystack for keyword in keywords)

    def _is_packaged_weight_item(self, item: ShoppingListItem) -> bool:
        name = self._normalize_name(item.product_name)
        category = self._normalize_name(item.product_category or "")

        packaged_keywords = {
            "tortilla", "wrap", "rallada", "rallado", "lavada", "lavado", "mezcla",
            "brotes", "bolsa", "granulado", "lomos", "filetes congelados", "lonchas",
        }
        if any(keyword in name for keyword in packaged_keywords):
            return True

        packaged_categories = {
            "panaderia y pasteleria", "charcuteria y quesos", "congelados",
            "conservas, caldos y cremas", "aceite, especias y salsas",
            "leche, huevos y mantequilla", "pastas", "arroz y cereales",
        }
        return category in packaged_categories

    def _guess_units_per_pack(self, item: ShoppingListItem) -> int | None:
        name = self._normalize_name(item.product_name)
        if "tortilla" in name or "wrap" in name:
            return 8
        if "lomos de salmon" in name or "salmon" in name:
            return 2
        return None

    @staticmethod
    def _is_cooking_measure(unit: str) -> bool:
        return unit in {
            "cucharada", "cucharadas", "cucharadita", "cucharaditas",
            "diente", "dientes", "pizca", "pizcas",
        }

    @staticmethod
    def _parse_pack_size(value: str) -> tuple[float, str] | None:
        text = ListService._normalize_name(value)
        match = re.search(r"(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|ud|uds|unidad|unidades)\b", text)
        if match:
            amount = float(match.group(1).replace(",", "."))
            unit = ListService._normalize_unit(match.group(2))
            return amount, unit

        if "docena" in text:
            return 12.0, "uds"

        return None

    @staticmethod
    def _parse_recipe_amounts(note: str) -> list[tuple[float, str]]:
        matches = re.findall(
            r"Cantidad receta:\s*(\d+(?:[.,]\d+)?)\s*([a-zA-ZáéíóúÁÉÍÓÚ]+)",
            note or "",
        )
        parsed: list[tuple[float, str]] = []
        for raw_amount, raw_unit in matches:
            parsed.append((float(raw_amount.replace(",", ".")), raw_unit))
        return parsed

    @staticmethod
    def _normalize_unit(value: str) -> str:
        unit = ListService._normalize_name(value)
        aliases = {
            "uds": "uds",
            "ud": "uds",
            "unidad": "uds",
            "unidades": "uds",
            "cucharada": "cucharada",
            "cucharadas": "cucharadas",
            "cucharadita": "cucharadita",
            "cucharaditas": "cucharaditas",
            "diente": "diente",
            "dientes": "dientes",
            "sobre": "sobre",
            "sobres": "sobre",
            "kg": "kg",
            "g": "g",
            "l": "l",
            "ml": "ml",
        }
        return aliases.get(unit, unit)

    @staticmethod
    def _units_compatible(left: str, right: str) -> bool:
        families = [
            {"kg", "g"},
            {"l", "ml"},
            {"uds"},
        ]
        return any(left in family and right in family for family in families)

    @staticmethod
    def _convert_amount(amount: float, from_unit: str, to_unit: str) -> float | None:
        if from_unit == to_unit:
            return amount

        conversions = {
            ("g", "kg"): amount / 1000,
            ("kg", "g"): amount * 1000,
            ("ml", "l"): amount / 1000,
            ("l", "ml"): amount * 1000,
        }

        key = (from_unit, to_unit)
        if key in conversions:
            return conversions[key]
        return None

    @classmethod
    def _name_tokens(cls, value: str) -> set[str]:
        normalized = cls._normalize_name(value)
        raw_tokens = re.findall(r"[a-z0-9]+", normalized)
        stopwords = {
            "de", "del", "la", "el", "los", "las", "y", "con", "sin", "para",
            "al", "a", "en", "tipo", "extra", "mini", "pack", "hacienda", "hacendado",
        }
        tokens: set[str] = set()
        for token in raw_tokens:
            if token in stopwords:
                continue
            if len(token) > 3 and token.endswith("es"):
                token = token[:-2]
            elif len(token) > 2 and token.endswith("s"):
                token = token[:-1]
            tokens.add(token)
        return tokens
