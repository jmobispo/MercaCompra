import json
from collections import Counter, defaultdict

import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.recipe import Recipe
from app.models.shopping_list import ShoppingList
from app.models.user import User
from app.models.weekly_plan import WeeklyPlan, WeeklyPlanDay
from app.core.secrets import decrypt_secret, encrypt_secret, is_encrypted_secret
from app.schemas.ai import (
    AIListOptimizeResult,
    AIRecipeEnrichPayload,
    AIRecipeEnrichResult,
    AIWeeklyPlanAssistResult,
)
from app.schemas.shopping_list import ShoppingListRead
from app.schemas.user import UserRead
from app.schemas.weekly_plan import WeeklyPlanRead
from app.services.list_service import ListService
from app.services.meal_planner_service import AUTO_PLANNED_SLOTS, MEAL_SLOTS
from app.services.weekly_plan_service import WeeklyPlanService


OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions"

MEAL_SLOT_PREFERENCES: dict[str, list[str]] = {
    "desayuno": ["desayuno"],
    "merienda": ["merienda", "desayuno", "postre"],
    "comida_primero": ["comida"],
    "comida_segundo": ["comida"],
    "comida_postre": ["postre", "merienda"],
    "cena_primero": ["cena"],
    "cena_segundo": ["cena"],
    "cena_postre": ["postre", "merienda"],
}

AI_PLANNED_SLOTS = set(AUTO_PLANNED_SLOTS)


class AIService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def enrich_recipe(self, user_id: int, payload: AIRecipeEnrichPayload) -> AIRecipeEnrichResult:
        user = await self._get_ai_ready_user(user_id, require_enabled_field="ai_recipe_autofill")
        ingredient_lines = [
            {
                "name": ingredient.name,
                "quantity": ingredient.quantity,
                "unit": ingredient.unit,
                "notes": ingredient.notes,
                "product_query": ingredient.product_query,
            }
            for ingredient in payload.ingredients
        ]
        current_steps = [step.model_dump() for step in payload.steps]
        prompt_payload = {
            "recipe": payload.model_dump(),
            "rules": {
                "fill_only_missing": True,
                "meal_types_allowed": ["desayuno", "comida", "cena", "merienda", "postre"],
                "max_tags": 6,
                "max_steps": 8,
            },
            "ingredients": ingredient_lines,
            "existing_steps": current_steps,
        }
        schema = {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "description": {"type": ["string", "null"]},
                "estimated_minutes": {"type": ["integer", "null"]},
                "estimated_cost": {"type": ["number", "null"]},
                "calories_per_serving": {"type": ["number", "null"]},
                "protein_g": {"type": ["number", "null"]},
                "carbs_g": {"type": ["number", "null"]},
                "fat_g": {"type": ["number", "null"]},
                "fiber_g": {"type": ["number", "null"]},
                "sugar_g": {"type": ["number", "null"]},
                "sodium_mg": {"type": ["number", "null"]},
                "meal_types": {"type": "array", "items": {"type": "string"}},
                "tags": {"type": "array", "items": {"type": "string"}},
                "steps": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "position": {"type": "integer"},
                            "text": {"type": "string"},
                        },
                        "required": ["position", "text"],
                    },
                },
                "summary": {"type": ["string", "null"]},
            },
            "required": [
                "description",
                "estimated_minutes",
                "estimated_cost",
                "calories_per_serving",
                "protein_g",
                "carbs_g",
                "fat_g",
                "fiber_g",
                "sugar_g",
                "sodium_mg",
                "meal_types",
                "tags",
                "steps",
                "summary",
            ],
        }
        system_prompt = (
            "Eres un asistente culinario y nutricional. Recibes una receta incompleta y debes completar "
            "solo lo que falte de forma prudente y útil. Devuelve siempre JSON válido. "
            "Las calorías y macros deben ser por ración. Si ya hay pasos existentes, respétalos salvo que estén vacíos. "
            "Los pasos deben ser claros, cortos y en español."
        )
        data = await self._chat_json(user, system_prompt, prompt_payload, schema)
        return AIRecipeEnrichResult.model_validate(data)

    async def optimize_list(self, user_id: int, list_id: int) -> AIListOptimizeResult:
        user = await self._get_ai_ready_user(user_id, require_enabled_field="ai_list_assist")
        list_service = ListService(self.db)
        shopping_list = await list_service.get_list_entity(list_id, user_id)
        items = shopping_list.items
        if not items:
            return AIListOptimizeResult(
                message="La lista ya está vacía.",
                applied_changes=0,
                shopping_list=ShoppingListRead.model_validate(shopping_list),
            )

        payload = {
            "list_name": shopping_list.name,
            "items": [
                {
                    "id": item.id,
                    "name": item.product_name,
                    "quantity": item.quantity,
                    "unit": item.product_unit,
                    "category": item.product_category,
                    "note": item.note,
                    "price": item.product_price,
                }
                for item in items
            ],
            "goal": "reduce absurd quantities, merge obvious duplicates, keep practical shopping quantities",
        }
        schema = {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "updates": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "item_id": {"type": "integer"},
                            "quantity": {"type": "integer"},
                            "reason": {"type": "string"},
                        },
                        "required": ["item_id", "quantity", "reason"],
                    },
                },
                "summary": {"type": "string"},
            },
            "required": ["updates", "summary"],
        }
        system_prompt = (
            "Eres un asistente de compra práctica. Ajusta cantidades exageradas de una lista generada por recetas. "
            "No pongas cantidades a cero. Sé conservador: cambia solo si está claramente sobredimensionado o duplicado. "
            "Si hay duda, deja la cantidad actual."
        )
        data = await self._chat_json(user, system_prompt, payload, schema)

        updates_by_id = {int(item["item_id"]): item for item in data.get("updates", [])}
        applied_changes = 0
        for item in items:
            suggestion = updates_by_id.get(item.id)
            if not suggestion:
                continue
            suggested_qty = max(1, int(suggestion["quantity"]))
            if suggested_qty != item.quantity:
                item.quantity = suggested_qty
                item.note = self._append_ai_note(item.note, suggestion["reason"])
                applied_changes += 1

        await self.db.commit()
        refreshed = await list_service.get_list(list_id, user_id)
        return AIListOptimizeResult(
            message=data.get("summary", "Lista revisada con IA."),
            applied_changes=applied_changes,
            shopping_list=refreshed,
        )

    async def assist_weekly_plan(self, user_id: int, plan_id: int) -> AIWeeklyPlanAssistResult:
        user = await self._get_ai_ready_user(user_id, require_enabled_field="ai_plan_assist")
        weekly_plan_service = WeeklyPlanService(self.db)
        plan = await weekly_plan_service._get_plan_or_404(plan_id, user_id)

        recipes_result = await self.db.execute(
            select(Recipe)
            .where((Recipe.user_id == user_id) | (Recipe.is_public == True))
            .order_by(Recipe.is_public.desc(), Recipe.title.asc())
        )
        recipes = list(recipes_result.scalars().all())

        empty_slots = [
            day for day in plan.days
            if day.recipe_id is None and day.meal_slot in AI_PLANNED_SLOTS
        ]
        if not empty_slots:
            return AIWeeklyPlanAssistResult(
                message="El plan ya está completo.",
                applied_slots=0,
                weekly_plan=weekly_plan_service._to_read(plan),
            )

        current_recipe_ids = [day.recipe_id for day in plan.days if day.recipe_id is not None]
        usage_counter = Counter(current_recipe_ids)

        slot_candidates = []
        for slot in empty_slots:
            preferred_meal_types = MEAL_SLOT_PREFERENCES.get(slot.meal_slot, ["comida"])
            candidates = [
                recipe for recipe in recipes
                if self._recipe_matches_slot(recipe, preferred_meal_types)
            ]
            ranked = sorted(
                candidates,
                key=lambda recipe: (
                    usage_counter.get(recipe.id, 0),
                    recipe.estimated_cost or 0,
                    recipe.estimated_minutes or 999,
                    recipe.title,
                ),
            )[:8]
            slot_candidates.append(
                {
                    "day_index": slot.day_index,
                    "meal_slot": slot.meal_slot,
                    "candidates": [
                        {
                            "recipe_id": recipe.id,
                            "title": recipe.title,
                            "meal_types": recipe.meal_types or [],
                            "minutes": recipe.estimated_minutes,
                            "cost": recipe.estimated_cost,
                            "calories": recipe.calories_per_serving,
                        }
                        for recipe in ranked
                    ],
                }
            )

        payload = {
            "plan": {
                "title": plan.title,
                "people_count": plan.people_count,
                "days_count": plan.days_count,
                "preferences": plan.preferences or {},
            },
            "empty_slots": slot_candidates,
            "rules": {
                "avoid_repetition": True,
                "respect_meal_types": True,
                "ignore_slots": ["merienda", "comida_postre", "cena_postre"],
            },
        }
        schema = {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "assignments": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "day_index": {"type": "integer"},
                            "meal_slot": {"type": "string"},
                            "recipe_id": {"type": "integer"},
                            "reason": {"type": "string"},
                        },
                        "required": ["day_index", "meal_slot", "recipe_id", "reason"],
                    },
                },
                "summary": {"type": "string"},
            },
            "required": ["assignments", "summary"],
        }
        system_prompt = (
            "Eres un planificador de menús. Elige una receta válida de entre las candidatas por cada hueco vacío. "
            "Respeta el tipo de comida y evita repetir demasiado la misma receta."
        )
        data = await self._chat_json(user, system_prompt, payload, schema)

        candidate_lookup = {
            (slot["day_index"], slot["meal_slot"]): {candidate["recipe_id"] for candidate in slot["candidates"]}
            for slot in slot_candidates
        }
        applied_slots = 0
        days_by_key: dict[tuple[int, str], WeeklyPlanDay] = {
            (day.day_index, day.meal_slot): day for day in plan.days
        }
        for assignment in data.get("assignments", []):
            key = (assignment["day_index"], assignment["meal_slot"])
            allowed_ids = candidate_lookup.get(key, set())
            recipe_id = assignment["recipe_id"]
            if recipe_id not in allowed_ids:
                continue
            target_day = days_by_key.get(key)
            if not target_day or target_day.recipe_id == recipe_id:
                continue
            target_day.recipe_id = recipe_id
            applied_slots += 1

        await self.db.commit()
        refreshed = await weekly_plan_service.get_plan(plan_id, user_id)
        return AIWeeklyPlanAssistResult(
            message=data.get("summary", "Plan completado con ayuda de IA."),
            applied_slots=applied_slots,
            weekly_plan=refreshed,
        )

    async def _get_ai_ready_user(self, user_id: int, require_enabled_field: str) -> User:
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        if not getattr(user, "ai_enabled", False):
            raise HTTPException(status_code=400, detail="La IA no está activada en tu cuenta")
        if not getattr(user, require_enabled_field, False):
            raise HTTPException(status_code=400, detail="Esta ayuda IA está desactivada en tu cuenta")
        if not getattr(user, "ai_api_key", None):
            raise HTTPException(status_code=400, detail="Falta la API key de IA en la configuración")
        if not is_encrypted_secret(user.ai_api_key):
            user.ai_api_key = encrypt_secret(user.ai_api_key)
            await self.db.commit()
            await self.db.refresh(user)
        return user

    async def _chat_json(self, user: User, system_prompt: str, payload: dict, schema: dict) -> dict:
        api_key = decrypt_secret(user.ai_api_key)
        if not api_key:
            raise HTTPException(status_code=400, detail="No se pudo leer la API key de IA")
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": user.ai_model or "gpt-4.1-mini",
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": (
                        "Devuelve estrictamente un JSON válido con esta estructura esperada: "
                        f"{json.dumps(schema, ensure_ascii=False)}\n\n"
                        f"Datos de entrada:\n{json.dumps(payload, ensure_ascii=False)}"
                    ),
                },
            ],
        }
        timeout = httpx.Timeout(45.0, connect=10.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(OPENAI_CHAT_COMPLETIONS_URL, headers=headers, json=body)

        if response.status_code >= 400:
            detail = response.text
            raise HTTPException(status_code=400, detail=f"Error IA: {detail[:300]}")

        data = response.json()
        try:
            content = data["choices"][0]["message"]["content"]
            return json.loads(content)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=502, detail="La IA devolvió una respuesta no válida") from exc

    @staticmethod
    def _recipe_matches_slot(recipe: Recipe, preferred_meal_types: list[str]) -> bool:
        meal_types = recipe.meal_types or []
        if not meal_types:
            return preferred_meal_types[0] in {"comida", "cena"}
        return any(meal_type in preferred_meal_types for meal_type in meal_types)

    @staticmethod
    def _append_ai_note(note: str | None, reason: str) -> str:
        ai_note = f"IA: {reason.strip()}"
        if not note:
            return ai_note
        if ai_note in note:
            return note
        return f"{note} | {ai_note}"
