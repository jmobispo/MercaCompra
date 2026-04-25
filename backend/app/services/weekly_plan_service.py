from dataclasses import asdict
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.habit import UserProductStats
from app.models.pantry import PantryItem
from app.models.recipe import Recipe
from app.models.shopping_list import ShoppingList, ShoppingListItem
from app.models.weekly_plan import WeeklyPlan, WeeklyPlanDay
from app.schemas.recipe import AddToListResult
from app.schemas.weekly_plan import (
    WeeklyPlanCreate,
    WeeklyPlanDayRead,
    WeeklyPlanDaySummaryRead,
    WeeklyPlanGeneratePayload,
    WeeklyPlanMealSummary,
    WeeklyPlanPreferences,
    WeeklyPlanRead,
    WeeklyPlanSummary,
    WeeklyPlanSummaryRead,
    WeeklyPlanUpdate,
)
from app.services.habit_service import HabitService
from app.services.list_service import ListService
from app.services.meal_planner_service import MEAL_SLOTS, MealPlannerService, normalize_preferences, recipe_cost_for_plan
from app.services.recipe_service import RecipeService, _build_ingredient_note, _infer_cart_quantity, _merge_notes


class WeeklyPlanService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_plans(self, user_id: int) -> list[WeeklyPlanSummary]:
        result = await self.db.execute(
            select(WeeklyPlan)
            .where(WeeklyPlan.user_id == user_id)
            .options(selectinload(WeeklyPlan.days).selectinload(WeeklyPlanDay.recipe))
            .order_by(WeeklyPlan.updated_at.desc())
        )
        plans = result.scalars().all()
        return [
            WeeklyPlanSummary(
                id=plan.id,
                title=plan.title,
                people_count=plan.people_count,
                days_count=plan.days_count,
                budget_target=plan.budget_target,
                assigned_days=sum(1 for day in plan.days if day.recipe_id is not None),
                created_at=plan.created_at,
                updated_at=plan.updated_at,
            )
            for plan in plans
        ]

    async def get_plan(self, plan_id: int, user_id: int) -> WeeklyPlanRead:
        plan = await self._get_plan_or_404(plan_id, user_id)
        return self._to_read(plan)

    async def get_summary(self, plan_id: int, user_id: int) -> WeeklyPlanSummaryRead:
        plan = await self._get_plan_or_404(plan_id, user_id)
        return self._build_summary(plan)

    async def create_plan(self, user_id: int, data: WeeklyPlanCreate) -> WeeklyPlanRead:
        plan = WeeklyPlan(
            user_id=user_id,
            title=data.title,
            people_count=data.people_count,
            days_count=data.days_count,
            start_date=data.start_date,
            budget_target=data.budget_target,
            preferences=data.preferences.model_dump() if data.preferences else None,
        )
        self.db.add(plan)
        await self.db.flush()
        await self.db.execute(delete(WeeklyPlanDay).where(WeeklyPlanDay.weekly_plan_id == plan.id))
        for day_index in range(data.days_count):
            for meal_slot in MEAL_SLOTS:
                self.db.add(
                    WeeklyPlanDay(
                        weekly_plan_id=plan.id,
                        day_index=day_index,
                        meal_slot=meal_slot,
                    )
                )
        await self.db.flush()
        await self._sync_days(plan.id, data.days_count, data.days)
        await self.db.commit()
        plan = await self._get_plan_or_404(plan.id, user_id)
        return self._to_read(plan)

    async def update_plan(self, plan_id: int, user_id: int, data: WeeklyPlanUpdate) -> WeeklyPlanRead:
        plan = await self._get_plan_or_404(plan_id, user_id)
        provided = data.model_fields_set
        if data.title is not None:
            plan.title = data.title
        if data.people_count is not None:
            plan.people_count = data.people_count
        if data.days_count is not None:
            plan.days_count = data.days_count
        if "start_date" in provided and data.start_date is not None:
            plan.start_date = data.start_date
        if "budget_target" in provided:
            plan.budget_target = data.budget_target
        if "preferences" in provided:
            plan.preferences = data.preferences.model_dump() if data.preferences else None

        await self._sync_days(plan.id, plan.days_count, data.days)
        plan.updated_at = datetime.now(timezone.utc)
        await self.db.commit()
        updated = await self._get_plan_or_404(plan_id, user_id)
        return self._to_read(updated)

    async def delete_plan(self, plan_id: int, user_id: int) -> None:
        plan = await self._get_plan_or_404(plan_id, user_id)
        await self.db.execute(delete(WeeklyPlanDay).where(WeeklyPlanDay.weekly_plan_id == plan.id))
        await self.db.execute(delete(WeeklyPlan).where(WeeklyPlan.id == plan.id, WeeklyPlan.user_id == user_id))
        await self.db.commit()

    async def generate_plan(self, plan_id: int, user_id: int) -> WeeklyPlanRead:
        plan = await self._get_plan_or_404(plan_id, user_id)
        recipes = await self._get_candidate_recipes(user_id)
        if not recipes:
            raise HTTPException(status_code=400, detail="No hay recetas disponibles para generar el plan")

        pantry_items = await self._get_active_pantry_items(user_id)
        habit_stats = await self._get_habit_stats(user_id)
        assignments = MealPlannerService(
            people_count=plan.people_count,
            days_count=plan.days_count,
            budget_target=plan.budget_target,
            preferences=plan.preferences,
            pantry_items=pantry_items,
            habit_stats=habit_stats,
        ).generate(recipes)

        for day in plan.days:
            recipe = assignments.get((day.day_index, day.meal_slot))
            day.recipe_id = recipe.id if recipe else None
            day.meal_type = day.meal_slot

        plan.updated_at = datetime.now(timezone.utc)
        await self.db.commit()
        refreshed = await self._get_plan_or_404(plan_id, user_id)
        return self._to_read(refreshed)

    async def generate_shopping_list(
        self,
        plan_id: int,
        user_id: int,
        payload: WeeklyPlanGeneratePayload,
    ) -> AddToListResult:
        plan = await self._get_plan_or_404(plan_id, user_id)
        recipe_service = RecipeService(self.db)
        habit_service = HabitService(self.db)
        postal_code = await recipe_service._get_user_postal_code(user_id)
        pantry_items = await recipe_service._get_active_pantry_items(user_id)

        if payload.list_id is not None:
            list_result = await self.db.execute(
                select(ShoppingList).where(
                    ShoppingList.id == payload.list_id,
                    ShoppingList.user_id == user_id,
                )
            )
            target_list = list_result.scalar_one_or_none()
            if not target_list:
                raise HTTPException(status_code=404, detail="Lista no encontrada")
        else:
            target_list = ShoppingList(
                user_id=user_id,
                name=payload.new_list_name or f"Plan semanal: {plan.title}",
                budget=plan.budget_target,
            )
            self.db.add(target_list)
            await self.db.flush()

        added_items: list[dict] = []
        skipped = 0
        resolved_real = 0
        resolved_fallback = 0
        unresolved = 0
        pantry_covered = 0
        pantry_reduced = 0
        consolidated: dict[str, dict] = {}
        optimization_applied = 0

        for day in plan.days:
            if not day.recipe:
                continue

            servings_multiplier = plan.people_count / max(day.recipe.servings or 1, 1)
            for ingredient in day.recipe.ingredients:
                product = await recipe_service._resolve_product_for_ingredient(ingredient, postal_code)
                product_id = product.id if product else f"weekly_{plan.id}_{ingredient.id}"
                note = _build_ingredient_note(ingredient, servings_multiplier)
                key = product_id if product else ingredient.name.strip().lower()
                adjusted_qty = _infer_cart_quantity(ingredient, servings_multiplier, product)
                adjusted_qty, covered_by_pantry, reduced_by_pantry = recipe_service._apply_pantry_coverage(
                    pantry_items,
                    ingredient,
                    product,
                    servings_multiplier,
                    adjusted_qty,
                )
                if covered_by_pantry:
                    skipped += 1
                    pantry_covered += 1
                    continue
                if reduced_by_pantry:
                    pantry_reduced += 1

                if key not in consolidated:
                    consolidated[key] = {
                        "product_id": product_id,
                        "product_name": product.name if product else ingredient.name,
                        "product_price": product.price if product else None,
                        "product_unit": product.unit_size if product else ingredient.unit,
                        "product_thumbnail": product.thumbnail if product else None,
                        "product_category": product.category if product else "Plan semanal",
                        "quantity": adjusted_qty,
                        "note": note,
                        "source": product.source if product else "manual",
                        "resolved": bool(product),
                    }
                else:
                    consolidated[key]["quantity"] += adjusted_qty
                    consolidated[key]["note"] = _merge_notes(consolidated[key]["note"], note)

                if product:
                    if product.source == "fallback":
                        resolved_fallback += 1
                    else:
                        resolved_real += 1
                else:
                    unresolved += 1

        for item_data in consolidated.values():
            existing_result = await self.db.execute(
                select(ShoppingListItem).where(
                    ShoppingListItem.shopping_list_id == target_list.id,
                    ShoppingListItem.product_id == item_data["product_id"],
                )
            )
            existing = existing_result.scalar_one_or_none()
            if existing:
                existing.quantity += item_data["quantity"]
                existing.note = _merge_notes(existing.note, item_data["note"])
            else:
                self.db.add(
                    ShoppingListItem(
                        shopping_list_id=target_list.id,
                        product_id=item_data["product_id"],
                        product_name=item_data["product_name"],
                        product_price=item_data["product_price"],
                        product_unit=item_data["product_unit"],
                        product_thumbnail=item_data["product_thumbnail"],
                        product_category=item_data["product_category"],
                        quantity=item_data["quantity"],
                        note=item_data["note"],
                    )
                )
            added_items.append(
                {
                    "name": item_data["product_name"],
                    "quantity": item_data["quantity"],
                    "price": item_data["product_price"],
                    "source": item_data["source"],
                    "resolved": item_data["resolved"],
                }
            )

        if not added_items:
            skipped = 1

        await habit_service.record_additions(
            user_id,
            [
                {
                    "product_id": item["product_id"],
                    "product_name": item["product_name"],
                    "product_price": item["product_price"],
                    "product_unit": item["product_unit"],
                    "product_thumbnail": item["product_thumbnail"],
                    "product_category": item["product_category"],
                    "quantity": item["quantity"],
                    "source": item["source"],
                }
                for item in consolidated.values()
            ],
        )
        await self.db.flush()

        list_service = ListService(self.db)
        optimization_preview = await list_service.optimize_list_preview(target_list.id, user_id)
        optimization_applied = len(optimization_preview["suggestions"])
        if optimization_applied:
            optimized_list = await list_service.apply_optimization(
                target_list.id,
                user_id,
                [suggestion["id"] for suggestion in optimization_preview["suggestions"]],
            )
            added_items = [
                {
                    "name": item.product_name,
                    "quantity": item.quantity,
                    "price": item.product_price,
                    "resolved": not item.product_id.startswith(("weekly_", "recipe_")),
                }
                for item in optimized_list.items
            ]

        await self.db.commit()

        return AddToListResult(
            list_id=target_list.id,
            list_name=target_list.name,
            added=len(added_items),
            skipped=skipped,
            items=added_items,
            resolved_real=resolved_real,
            resolved_fallback=resolved_fallback,
            unresolved=unresolved,
            pantry_covered=pantry_covered,
            pantry_reduced=pantry_reduced,
            optimization_suggestions_applied=optimization_applied,
        )

    async def _get_plan_or_404(self, plan_id: int, user_id: int) -> WeeklyPlan:
        result = await self.db.execute(
            select(WeeklyPlan)
            .where(WeeklyPlan.id == plan_id, WeeklyPlan.user_id == user_id)
            .options(
                selectinload(WeeklyPlan.days).selectinload(WeeklyPlanDay.recipe).selectinload(Recipe.ingredients)
            )
        )
        plan = result.scalar_one_or_none()
        if not plan:
            raise HTTPException(status_code=404, detail="Plan semanal no encontrado")
        expected_slots = {(day_index, meal_slot) for day_index in range(plan.days_count) for meal_slot in MEAL_SLOTS}
        current_slots = {(day.day_index, day.meal_slot) for day in plan.days}
        has_legacy_slots = any(day.meal_slot in {"comida", "cena"} for day in plan.days)
        if has_legacy_slots or current_slots != expected_slots:
            await self._sync_days(plan.id, plan.days_count, None)
            await self.db.commit()
            result = await self.db.execute(
                select(WeeklyPlan)
                .where(WeeklyPlan.id == plan_id, WeeklyPlan.user_id == user_id)
                .options(
                    selectinload(WeeklyPlan.days).selectinload(WeeklyPlanDay.recipe).selectinload(Recipe.ingredients)
                )
            )
            plan = result.scalar_one_or_none()
            if not plan:
                raise HTTPException(status_code=404, detail="Plan semanal no encontrado")
        return plan

    async def _get_candidate_recipes(self, user_id: int) -> list[Recipe]:
        result = await self.db.execute(
            select(Recipe)
            .where(or_(Recipe.is_public.is_(True), Recipe.user_id == user_id))
            .options(selectinload(Recipe.ingredients))
        )
        return list(result.scalars().unique().all())

    async def _get_active_pantry_items(self, user_id: int) -> list[PantryItem]:
        result = await self.db.execute(
            select(PantryItem)
            .where(PantryItem.user_id == user_id, PantryItem.is_consumed.is_(False))
        )
        return list(result.scalars().all())

    async def _get_habit_stats(self, user_id: int) -> list[UserProductStats]:
        result = await self.db.execute(
            select(UserProductStats)
            .where(UserProductStats.user_id == user_id)
            .order_by(UserProductStats.times_added.desc(), UserProductStats.last_added_at.desc())
            .limit(20)
        )
        return list(result.scalars().all())

    async def _sync_days(
        self,
        plan_id: int,
        days_count: int,
        incoming_days: Optional[list],
    ) -> None:
        result = await self.db.execute(
            select(WeeklyPlanDay).where(WeeklyPlanDay.weekly_plan_id == plan_id)
        )
        days = list(result.scalars().all())
        for day in days:
            if day.meal_slot == "comida":
                day.meal_slot = "comida_primero"
                if day.meal_type == "comida":
                    day.meal_type = "comida_primero"
            elif day.meal_slot == "cena":
                day.meal_slot = "cena_primero"
                if day.meal_type == "cena":
                    day.meal_type = "cena_primero"
        indexed = {(day.day_index, day.meal_slot): day for day in days}
        for day_index in range(days_count):
            for meal_slot in MEAL_SLOTS:
                key = (day_index, meal_slot)
                if key not in indexed:
                    new_day = WeeklyPlanDay(weekly_plan_id=plan_id, day_index=day_index, meal_slot=meal_slot)
                    self.db.add(new_day)
                    indexed[key] = new_day

        for day in list(indexed.values()):
            if day.day_index >= days_count:
                await self.db.delete(day)

        if incoming_days is None:
            await self.db.flush()
            return

        current = indexed
        for day_input in incoming_days:
            if day_input.day_index >= days_count:
                continue
            key = (day_input.day_index, day_input.meal_slot)
            day = current.get(key)
            if day is None:
                day = WeeklyPlanDay(
                    weekly_plan_id=plan_id,
                    day_index=day_input.day_index,
                    meal_slot=day_input.meal_slot,
                )
                self.db.add(day)
            day.recipe_id = day_input.recipe_id
            day.meal_type = day_input.meal_type

        await self.db.flush()

    def _to_read(self, plan: WeeklyPlan) -> WeeklyPlanRead:
        return WeeklyPlanRead(
            id=plan.id,
            user_id=plan.user_id,
            title=plan.title,
            people_count=plan.people_count,
            days_count=plan.days_count,
            start_date=plan.start_date,
            budget_target=plan.budget_target,
            preferences=self._normalized_preferences(plan.preferences),
            created_at=plan.created_at,
            updated_at=plan.updated_at,
            days=[
                WeeklyPlanDayRead(
                    id=day.id,
                    day_index=day.day_index,
                    meal_slot=day.meal_slot,
                    recipe_id=day.recipe_id,
                    recipe_title=day.recipe.title if day.recipe else None,
                    meal_type=day.meal_type,
                )
                for day in sorted(plan.days, key=lambda item: (item.day_index, MEAL_SLOTS.index(item.meal_slot)))
            ],
        )

    def _normalized_preferences(self, preferences: dict | None) -> WeeklyPlanPreferences:
        return WeeklyPlanPreferences.model_validate(asdict(normalize_preferences(preferences)))

    def _build_summary(self, plan: WeeklyPlan) -> WeeklyPlanSummaryRead:
        daily: list[WeeklyPlanDaySummaryRead] = []
        total_cost = 0.0
        total_calories = 0.0
        total_protein = 0.0
        total_carbs = 0.0
        total_fat = 0.0

        for day_index in range(plan.days_count):
            day_date = date.fromordinal(plan.start_date.toordinal() + day_index)
            meals: list[WeeklyPlanMealSummary] = []
            day_cost = 0.0
            day_calories = 0.0
            day_protein = 0.0
            day_carbs = 0.0
            day_fat = 0.0

            for meal_slot in MEAL_SLOTS:
                day = next(
                    (slot for slot in plan.days if slot.day_index == day_index and slot.meal_slot == meal_slot),
                    None,
                )
                recipe = day.recipe if day else None
                meal_cost = recipe_cost_for_plan(recipe, plan.people_count) if recipe else 0.0
                calories = float(recipe.calories_per_serving or 0.0) if recipe else 0.0
                protein = float(recipe.protein_g or 0.0) if recipe else 0.0
                carbs = float(recipe.carbs_g or 0.0) if recipe else 0.0
                fat = float(recipe.fat_g or 0.0) if recipe else 0.0

                meals.append(
                    WeeklyPlanMealSummary(
                        meal_slot=meal_slot,
                        recipe_id=recipe.id if recipe else None,
                        recipe_title=recipe.title if recipe else None,
                        calories=round(calories, 1),
                        protein_g=round(protein, 1),
                        carbs_g=round(carbs, 1),
                        fat_g=round(fat, 1),
                        estimated_cost=round(meal_cost, 2),
                        meal_types=list(recipe.meal_types or []) if recipe else [],
                    )
                )

                day_cost += meal_cost
                day_calories += calories
                day_protein += protein
                day_carbs += carbs
                day_fat += fat

            total_cost += day_cost
            total_calories += day_calories
            total_protein += day_protein
            total_carbs += day_carbs
            total_fat += day_fat

            daily.append(
                WeeklyPlanDaySummaryRead(
                    day_index=day_index,
                    date=day_date,
                    estimated_day_cost=round(day_cost, 2),
                    estimated_day_calories=round(day_calories, 1),
                    protein_g=round(day_protein, 1),
                    carbs_g=round(day_carbs, 1),
                    fat_g=round(day_fat, 1),
                    meals=meals,
                )
            )

        budget_remaining = round((plan.budget_target or 0.0) - total_cost, 2) if plan.budget_target is not None else None
        return WeeklyPlanSummaryRead(
            plan_id=plan.id,
            title=plan.title,
            people_count=plan.people_count,
            days_count=plan.days_count,
            budget_target=plan.budget_target,
            preferences=self._normalized_preferences(plan.preferences),
            total_estimated_cost=round(total_cost, 2),
            total_estimated_calories=round(total_calories, 1),
            total_protein_g=round(total_protein, 1),
            total_carbs_g=round(total_carbs, 1),
            total_fat_g=round(total_fat, 1),
            average_daily_calories=round(total_calories / max(plan.days_count, 1), 1),
            average_daily_cost=round(total_cost / max(plan.days_count, 1), 2),
            budget_remaining=budget_remaining,
            within_budget=(budget_remaining >= 0) if budget_remaining is not None else None,
            days=daily,
        )
