from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from statistics import mean
from typing import Iterable

from app.models.habit import UserProductStats
from app.models.pantry import PantryItem
from app.models.recipe import Recipe
from app.services.pantry_support import name_tokens, names_match, pantry_matches_item

MEAL_SLOTS = ("desayuno", "comida", "cena")

PROTEIN_KEYWORDS = {
    "pollo": "pollo",
    "pavo": "pavo",
    "ternera": "ternera",
    "carne": "carne",
    "cerdo": "cerdo",
    "jamon": "cerdo",
    "bacon": "cerdo",
    "chorizo": "cerdo",
    "atun": "pescado",
    "bacalao": "pescado",
    "merluza": "pescado",
    "salmon": "pescado",
    "pescado": "pescado",
    "garbanzo": "legumbre",
    "lenteja": "legumbre",
    "alubia": "legumbre",
    "huevo": "huevo",
    "queso": "queso",
}

FAMILY_TAGS = {
    "casero",
    "casera",
    "familiar",
    "tradicional",
    "clasico",
    "clasica",
    "simple",
    "rapido",
    "rapida",
}


@dataclass(slots=True)
class PlannerPreferences:
    economico: bool = False
    rapido: bool = False
    saludable: bool = False
    familiar: bool = False


@dataclass(slots=True)
class PlannerContext:
    people_count: int
    days_count: int
    budget_target: float | None
    preferences: PlannerPreferences
    pantry_items: list[PantryItem]
    habit_stats: list[UserProductStats]
    recipe_repeat_counts: Counter[int]
    total_cost_so_far: float
    previous_recipe_by_slot: dict[str, Recipe]
    previous_day_recipes: list[Recipe]
    max_cost: float
    max_minutes: float


def normalize_preferences(raw: dict | None) -> PlannerPreferences:
    payload = raw or {}
    return PlannerPreferences(
        economico=bool(payload.get("economico")),
        rapido=bool(payload.get("rapido")),
        saludable=bool(payload.get("saludable")),
        familiar=bool(payload.get("familiar")),
    )


def recipe_cost_for_plan(recipe: Recipe, people_count: int) -> float:
    if recipe.estimated_cost is None:
        return 0.0
    servings = max(recipe.servings or 1, 1)
    return round(float(recipe.estimated_cost) * (people_count / servings), 2)


def recipe_similarity(left: Recipe, right: Recipe) -> float:
    left_tokens = name_tokens(left.title)
    right_tokens = name_tokens(right.title)
    if not left_tokens or not right_tokens:
        return 0.0
    return len(left_tokens & right_tokens) / max(len(left_tokens | right_tokens), 1)


def detect_primary_protein(recipe: Recipe) -> str | None:
    text = " ".join(
        [
            recipe.title or "",
            recipe.description or "",
            *(ingredient.name for ingredient in recipe.ingredients),
        ]
    ).lower()
    for keyword, family in PROTEIN_KEYWORDS.items():
        if keyword in text:
            return family
    return None


def recipe_is_family_friendly(recipe: Recipe) -> bool:
    tags = {str(tag).strip().lower() for tag in (recipe.tags or [])}
    title_tokens = name_tokens(recipe.title)
    return bool(tags & FAMILY_TAGS or title_tokens & FAMILY_TAGS)


def pantry_match_ratio(recipe: Recipe, pantry_items: Iterable[PantryItem]) -> float:
    ingredients = list(recipe.ingredients)
    if not ingredients:
        return 0.0
    matched = 0
    for ingredient in ingredients:
        if any(
            pantry_matches_item(
                pantry_item,
                product_id=None,
                product_name=ingredient.product_query or ingredient.name,
                ingredient_name=ingredient.name,
            )
            for pantry_item in pantry_items
            if not pantry_item.is_consumed
        ):
            matched += 1
    return matched / max(len(ingredients), 1)


def habit_match_ratio(recipe: Recipe, habit_stats: Iterable[UserProductStats]) -> float:
    ingredients = list(recipe.ingredients)
    if not ingredients:
        return 0.0
    matched = 0
    habit_names = [stat.product_name for stat in habit_stats]
    for ingredient in ingredients:
        if any(names_match(product_name, ingredient.name) for product_name in habit_names):
            matched += 1
    return matched / max(len(ingredients), 1)


def healthy_score(recipe: Recipe) -> float:
    calories = float(recipe.calories_per_serving or 0.0)
    protein = float(recipe.protein_g or 0.0)
    carbs = float(recipe.carbs_g or 0.0)
    fat = float(recipe.fat_g or 0.0)
    fiber = float(recipe.fiber_g or 0.0)
    sugar = float(recipe.sugar_g or 0.0)

    score = 0.0
    score += min(protein / 3.0, 12.0)
    score += min(fiber * 1.5, 8.0)
    score -= min(max(fat - 18.0, 0.0) * 0.6, 8.0)
    score -= min(max(sugar - 10.0, 0.0) * 0.5, 6.0)
    if calories:
        if 250 <= calories <= 750:
            score += 6.0
        elif calories > 950:
            score -= 8.0
    if carbs and protein:
        score += min((protein / max(carbs, 1.0)) * 4.0, 6.0)
    return score


def meal_balance_adjustment(recipe: Recipe, meal_slot: str) -> float:
    calories = float(recipe.calories_per_serving or 0.0)
    if calories <= 0:
        return 0.0
    if meal_slot == "desayuno":
        if 220 <= calories <= 550:
            return 7.0
        if calories > 700:
            return -8.0
        return -2.0
    if meal_slot == "comida":
        if 450 <= calories <= 950:
            return 7.0
        return -1.0
    if meal_slot == "cena":
        if 280 <= calories <= 700:
            return 7.0
        if calories > 850:
            return -10.0
        return -1.5
    return 0.0


def preference_score(recipe: Recipe, meal_slot: str, ctx: PlannerContext) -> float:
    score = 0.0
    cost = recipe_cost_for_plan(recipe, ctx.people_count)
    minutes = float(recipe.estimated_minutes or 0.0)

    if ctx.preferences.economico:
        if ctx.max_cost > 0:
            score += (1 - (cost / ctx.max_cost)) * 18.0
        else:
            score += 6.0

    if ctx.preferences.rapido:
        if ctx.max_minutes > 0 and minutes > 0:
            score += (1 - (minutes / ctx.max_minutes)) * 18.0
        elif minutes == 0:
            score += 4.0

    if ctx.preferences.saludable:
        score += healthy_score(recipe)

    if ctx.preferences.familiar:
        if recipe_is_family_friendly(recipe):
            score += 12.0
        if minutes and minutes <= 45:
            score += 3.0
        if cost and cost <= mean([ctx.max_cost, cost]):
            score += 2.0

    score += meal_balance_adjustment(recipe, meal_slot)
    return score


def repetition_penalty(recipe: Recipe, meal_slot: str, ctx: PlannerContext) -> float:
    penalty = float(ctx.recipe_repeat_counts.get(recipe.id, 0) * 28.0)

    previous_same_slot = ctx.previous_recipe_by_slot.get(meal_slot)
    if previous_same_slot:
        if previous_same_slot.id == recipe.id:
            penalty += 55.0
        penalty += recipe_similarity(recipe, previous_same_slot) * 14.0

    if ctx.previous_day_recipes:
        penalty += sum(recipe_similarity(recipe, previous) * 10.0 for previous in ctx.previous_day_recipes)
        current_protein = detect_primary_protein(recipe)
        previous_proteins = {detect_primary_protein(previous) for previous in ctx.previous_day_recipes}
        if current_protein and current_protein in previous_proteins:
            penalty += 12.0

    return penalty


def budget_penalty(recipe: Recipe, day_index: int, ctx: PlannerContext) -> float:
    if not ctx.budget_target:
        return 0.0

    projected_cost = ctx.total_cost_so_far + recipe_cost_for_plan(recipe, ctx.people_count)
    weekly_target = float(ctx.budget_target)
    if projected_cost <= weekly_target:
        return 0.0

    overrun = projected_cost - weekly_target
    remaining_days = max(ctx.days_count - day_index - 1, 0)
    pressure = 1.0 if remaining_days <= 1 else 0.65
    return min(overrun * pressure, 30.0)


class MealPlannerService:
    def __init__(
        self,
        *,
        people_count: int,
        days_count: int,
        budget_target: float | None,
        preferences: dict | None,
        pantry_items: list[PantryItem],
        habit_stats: list[UserProductStats],
    ) -> None:
        self.people_count = people_count
        self.days_count = days_count
        self.budget_target = budget_target
        self.preferences = normalize_preferences(preferences)
        self.pantry_items = pantry_items
        self.habit_stats = habit_stats

    def generate(self, recipes: list[Recipe]) -> dict[tuple[int, str], Recipe]:
        if not recipes:
            return {}

        max_cost = max((recipe_cost_for_plan(recipe, self.people_count) for recipe in recipes), default=0.0)
        max_minutes = max((float(recipe.estimated_minutes or 0.0) for recipe in recipes), default=0.0)

        assignments: dict[tuple[int, str], Recipe] = {}
        recipe_repeat_counts: Counter[int] = Counter()
        total_cost_so_far = 0.0
        previous_recipe_by_slot: dict[str, Recipe] = {}

        for day_index in range(self.days_count):
            previous_day_recipes = [
                assignments[(day_index - 1, slot)]
                for slot in MEAL_SLOTS
                if (day_index - 1, slot) in assignments
            ]
            for meal_slot in MEAL_SLOTS:
                ctx = PlannerContext(
                    people_count=self.people_count,
                    days_count=self.days_count,
                    budget_target=self.budget_target,
                    preferences=self.preferences,
                    pantry_items=self.pantry_items,
                    habit_stats=self.habit_stats,
                    recipe_repeat_counts=recipe_repeat_counts,
                    total_cost_so_far=total_cost_so_far,
                    previous_recipe_by_slot=previous_recipe_by_slot,
                    previous_day_recipes=previous_day_recipes,
                    max_cost=max_cost,
                    max_minutes=max_minutes,
                )

                ranked_candidates = self._rank_candidates(recipes, meal_slot, day_index, ctx)
                if not ranked_candidates:
                    continue
                selected = ranked_candidates[0]
                assignments[(day_index, meal_slot)] = selected
                recipe_repeat_counts[selected.id] += 1
                previous_recipe_by_slot[meal_slot] = selected
                total_cost_so_far += recipe_cost_for_plan(selected, self.people_count)

        return assignments

    def _rank_candidates(
        self,
        recipes: list[Recipe],
        meal_slot: str,
        day_index: int,
        ctx: PlannerContext,
    ) -> list[Recipe]:
        preferred = [recipe for recipe in recipes if meal_slot in (recipe.meal_types or [])]
        neutral = [recipe for recipe in recipes if not recipe.meal_types]
        fallback = preferred or neutral or recipes

        scored: list[tuple[float, float, float, int, Recipe]] = []
        for recipe in fallback:
            pantry_ratio = pantry_match_ratio(recipe, ctx.pantry_items)
            habit_ratio = habit_match_ratio(recipe, ctx.habit_stats)
            score = 0.0
            score += 35.0 if meal_slot in (recipe.meal_types or []) else 8.0
            score += preference_score(recipe, meal_slot, ctx)
            score += pantry_ratio * 16.0
            score += habit_ratio * 8.0
            score -= repetition_penalty(recipe, meal_slot, ctx)
            score -= budget_penalty(recipe, day_index, ctx)
            scored.append(
                (
                    -round(score, 4),
                    recipe_cost_for_plan(recipe, self.people_count),
                    float(recipe.estimated_minutes or 999.0),
                    recipe.id,
                    recipe,
                )
            )

        scored.sort(key=lambda item: item[:4])
        return [item[4] for item in scored]
