"""
Recipe service — CRUD, add-to-list, and seed data.
"""
import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.recipe import Recipe, RecipeIngredient
from app.models.shopping_list import ShoppingList, ShoppingListItem
from app.schemas.recipe import (
    RecipeCreate, RecipeUpdate, RecipeRead, RecipeSummary,
    AddToListPayload, AddToListResult,
)

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Seed data — public template recipes shown to all users
# ─────────────────────────────────────────────────────────────────────────────
SEED_RECIPES = [
    {
        "title": "Espaguetis a la Carbonara",
        "description": "Clásica receta italiana con huevo, queso pecorino o parmesano, guanciale o bacon y pimienta negra. Sin nata.",
        "servings": 4,
        "estimated_minutes": 25,
        "estimated_cost": 6.50,
        "tags": ["pasta", "italiana", "rápida"],
        "ingredients": [
            {"name": "Espaguetis", "quantity": 400, "unit": "g", "product_query": "espaguetis"},
            {"name": "Bacon o guanciale", "quantity": 150, "unit": "g", "product_query": "bacon ahumado"},
            {"name": "Huevos", "quantity": 4, "unit": "uds", "product_query": "huevos"},
            {"name": "Queso parmesano rallado", "quantity": 80, "unit": "g", "product_query": "queso parmesano"},
            {"name": "Pimienta negra", "quantity": None, "unit": "al gusto", "product_query": "pimienta negra"},
            {"name": "Sal", "quantity": None, "unit": "al gusto", "product_query": "sal"},
        ],
    },
    {
        "title": "Macarrones con Tomate y Queso",
        "description": "Pasta al horno con salsa de tomate casera, queso rallado y orégano. Un clásico que gusta a todos.",
        "servings": 4,
        "estimated_minutes": 35,
        "estimated_cost": 4.20,
        "tags": ["pasta", "fácil", "horno"],
        "ingredients": [
            {"name": "Macarrones", "quantity": 400, "unit": "g", "product_query": "macarrones"},
            {"name": "Tomate frito", "quantity": 400, "unit": "g", "product_query": "tomate frito"},
            {"name": "Queso mozzarella rallado", "quantity": 150, "unit": "g", "product_query": "queso mozzarella"},
            {"name": "Queso parmesano", "quantity": 50, "unit": "g", "product_query": "queso parmesano"},
            {"name": "Aceite de oliva", "quantity": 2, "unit": "cucharadas", "product_query": "aceite oliva"},
            {"name": "Orégano", "quantity": None, "unit": "al gusto", "product_query": "orégano"},
            {"name": "Sal y pimienta", "quantity": None, "unit": "al gusto", "product_query": "sal"},
        ],
    },
    {
        "title": "Tortilla de Patatas",
        "description": "La receta clásica española con patata y huevo. Jugosa por dentro y dorada por fuera.",
        "servings": 4,
        "estimated_minutes": 40,
        "estimated_cost": 3.80,
        "tags": ["española", "huevos", "clásica"],
        "ingredients": [
            {"name": "Patatas", "quantity": 600, "unit": "g", "product_query": "patatas"},
            {"name": "Huevos", "quantity": 5, "unit": "uds", "product_query": "huevos"},
            {"name": "Cebolla", "quantity": 1, "unit": "ud", "product_query": "cebolla"},
            {"name": "Aceite de oliva", "quantity": 200, "unit": "ml", "product_query": "aceite oliva"},
            {"name": "Sal", "quantity": None, "unit": "al gusto", "product_query": "sal"},
        ],
    },
    {
        "title": "Arroz con Pollo",
        "description": "Arroz meloso con pollo, verduras y caldo. Plato completo y reconfortante.",
        "servings": 4,
        "estimated_minutes": 50,
        "estimated_cost": 8.50,
        "tags": ["arroz", "pollo", "completo"],
        "ingredients": [
            {"name": "Arroz redondo", "quantity": 320, "unit": "g", "product_query": "arroz redondo"},
            {"name": "Muslos de pollo", "quantity": 800, "unit": "g", "product_query": "muslos pollo"},
            {"name": "Pimiento rojo", "quantity": 1, "unit": "ud", "product_query": "pimiento rojo"},
            {"name": "Cebolla", "quantity": 1, "unit": "ud", "product_query": "cebolla"},
            {"name": "Tomate triturado", "quantity": 200, "unit": "g", "product_query": "tomate triturado"},
            {"name": "Caldo de pollo", "quantity": 800, "unit": "ml", "product_query": "caldo pollo"},
            {"name": "Ajo", "quantity": 3, "unit": "dientes", "product_query": "ajo"},
            {"name": "Aceite de oliva", "quantity": 3, "unit": "cucharadas", "product_query": "aceite oliva"},
            {"name": "Pimentón dulce", "quantity": 1, "unit": "cucharadita", "product_query": "pimentón dulce"},
            {"name": "Azafrán", "quantity": None, "unit": "unas hebras", "product_query": "azafrán"},
            {"name": "Sal y pimienta", "quantity": None, "unit": "al gusto", "product_query": "sal"},
        ],
    },
    {
        "title": "Pasta Boloñesa",
        "description": "Ragú de carne con tomate a fuego lento. Mejor si reposa. Acompaña con parmesano.",
        "servings": 4,
        "estimated_minutes": 60,
        "estimated_cost": 9.00,
        "tags": ["pasta", "carne", "italiana"],
        "ingredients": [
            {"name": "Espaguetis o tagliatelle", "quantity": 400, "unit": "g", "product_query": "espaguetis"},
            {"name": "Carne picada mixta", "quantity": 400, "unit": "g", "product_query": "carne picada"},
            {"name": "Tomate triturado", "quantity": 400, "unit": "g", "product_query": "tomate triturado"},
            {"name": "Cebolla", "quantity": 1, "unit": "ud", "product_query": "cebolla"},
            {"name": "Zanahoria", "quantity": 1, "unit": "ud", "product_query": "zanahoria"},
            {"name": "Ajo", "quantity": 2, "unit": "dientes", "product_query": "ajo"},
            {"name": "Vino tinto", "quantity": 100, "unit": "ml", "product_query": "vino tinto"},
            {"name": "Aceite de oliva", "quantity": 2, "unit": "cucharadas", "product_query": "aceite oliva"},
            {"name": "Queso parmesano", "quantity": 60, "unit": "g", "product_query": "queso parmesano"},
            {"name": "Sal y pimienta", "quantity": None, "unit": "al gusto", "product_query": "sal"},
        ],
    },
    {
        "title": "Ensalada Mixta",
        "description": "Ensalada fresca con lechuga, tomate, cebolla, atún y aceitunas. Aliño de aceite y vinagre.",
        "servings": 2,
        "estimated_minutes": 10,
        "estimated_cost": 4.00,
        "tags": ["ensalada", "rápida", "saludable"],
        "ingredients": [
            {"name": "Lechuga iceberg", "quantity": 1, "unit": "ud", "product_query": "lechuga"},
            {"name": "Tomate", "quantity": 2, "unit": "uds", "product_query": "tomate"},
            {"name": "Cebolla", "quantity": 0.5, "unit": "ud", "product_query": "cebolla"},
            {"name": "Atún en aceite", "quantity": 160, "unit": "g", "product_query": "atún aceite"},
            {"name": "Aceitunas", "quantity": 50, "unit": "g", "product_query": "aceitunas"},
            {"name": "Aceite de oliva", "quantity": 3, "unit": "cucharadas", "product_query": "aceite oliva"},
            {"name": "Vinagre de vino", "quantity": 1, "unit": "cucharada", "product_query": "vinagre"},
            {"name": "Sal", "quantity": None, "unit": "al gusto", "product_query": "sal"},
        ],
    },
    {
        "title": "Lasaña de Carne",
        "description": "Lasaña clásica con ragú de carne, bechamel casera y capas de pasta al horno.",
        "servings": 6,
        "estimated_minutes": 90,
        "estimated_cost": 12.00,
        "tags": ["pasta", "horno", "carne"],
        "ingredients": [
            {"name": "Placas de lasaña", "quantity": 250, "unit": "g", "product_query": "pasta lasaña"},
            {"name": "Carne picada mixta", "quantity": 500, "unit": "g", "product_query": "carne picada"},
            {"name": "Bechamel lista", "quantity": 500, "unit": "ml", "product_query": "bechamel"},
            {"name": "Tomate frito", "quantity": 400, "unit": "g", "product_query": "tomate frito"},
            {"name": "Cebolla", "quantity": 1, "unit": "ud", "product_query": "cebolla"},
            {"name": "Queso mozzarella rallado", "quantity": 200, "unit": "g", "product_query": "queso mozzarella"},
            {"name": "Queso parmesano", "quantity": 60, "unit": "g", "product_query": "queso parmesano"},
            {"name": "Aceite de oliva", "quantity": 2, "unit": "cucharadas", "product_query": "aceite oliva"},
            {"name": "Sal y pimienta", "quantity": None, "unit": "al gusto", "product_query": "sal"},
        ],
    },
    {
        "title": "Crema de Verduras",
        "description": "Sopa-crema suave con calabacín, zanahoria y patata. Ligera, saludable y sabrosa.",
        "servings": 4,
        "estimated_minutes": 30,
        "estimated_cost": 4.50,
        "tags": ["sopa", "verduras", "saludable"],
        "ingredients": [
            {"name": "Calabacín", "quantity": 2, "unit": "uds", "product_query": "calabacín"},
            {"name": "Zanahoria", "quantity": 2, "unit": "uds", "product_query": "zanahoria"},
            {"name": "Patata", "quantity": 2, "unit": "uds", "product_query": "patatas"},
            {"name": "Cebolla", "quantity": 1, "unit": "ud", "product_query": "cebolla"},
            {"name": "Caldo de verduras", "quantity": 800, "unit": "ml", "product_query": "caldo verduras"},
            {"name": "Nata para cocinar", "quantity": 100, "unit": "ml", "product_query": "nata cocinar"},
            {"name": "Aceite de oliva", "quantity": 2, "unit": "cucharadas", "product_query": "aceite oliva"},
            {"name": "Sal y pimienta", "quantity": None, "unit": "al gusto", "product_query": "sal"},
        ],
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# Service
# ─────────────────────────────────────────────────────────────────────────────

class RecipeService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Seed ──────────────────────────────────────────────────────────────────

    async def ensure_seeds(self) -> None:
        """Insert seed/template recipes if none exist yet (first run)."""
        result = await self.db.execute(
            select(func.count(Recipe.id)).where(Recipe.is_public == True)
        )
        count = result.scalar_one()
        if count > 0:
            return

        logger.info("Inserting seed recipes...")
        for seed in SEED_RECIPES:
            recipe = Recipe(
                user_id=None,
                title=seed["title"],
                description=seed.get("description"),
                servings=seed.get("servings", 4),
                estimated_minutes=seed.get("estimated_minutes"),
                estimated_cost=seed.get("estimated_cost"),
                tags=seed.get("tags"),
                is_public=True,
            )
            self.db.add(recipe)
            await self.db.flush()

            for pos, ing_data in enumerate(seed.get("ingredients", [])):
                ing = RecipeIngredient(
                    recipe_id=recipe.id,
                    name=ing_data["name"],
                    quantity=ing_data.get("quantity"),
                    unit=ing_data.get("unit"),
                    notes=ing_data.get("notes"),
                    product_query=ing_data.get("product_query"),
                    position=pos,
                )
                self.db.add(ing)

        await self.db.commit()
        logger.info(f"Seeded {len(SEED_RECIPES)} public recipes")

    # ── Helpers ───────────────────────────────────────────────────────────────

    async def _get_recipe_or_404(self, recipe_id: int, user_id: int) -> Recipe:
        result = await self.db.execute(
            select(Recipe)
            .where(
                Recipe.id == recipe_id,
                (Recipe.user_id == user_id) | (Recipe.is_public == True),
            )
            .options(selectinload(Recipe.ingredients))
        )
        recipe = result.scalar_one_or_none()
        if not recipe:
            raise HTTPException(status_code=404, detail="Receta no encontrada")
        return recipe

    async def _get_own_recipe_or_404(self, recipe_id: int, user_id: int) -> Recipe:
        """Get recipe that belongs to this user (for mutations)."""
        result = await self.db.execute(
            select(Recipe)
            .where(Recipe.id == recipe_id, Recipe.user_id == user_id)
            .options(selectinload(Recipe.ingredients))
        )
        recipe = result.scalar_one_or_none()
        if not recipe:
            raise HTTPException(status_code=404, detail="Receta no encontrada o sin permiso")
        return recipe

    def _to_summary(self, recipe: Recipe) -> RecipeSummary:
        return RecipeSummary(
            id=recipe.id,
            user_id=recipe.user_id,
            title=recipe.title,
            description=recipe.description,
            servings=recipe.servings,
            estimated_minutes=recipe.estimated_minutes,
            estimated_cost=recipe.estimated_cost,
            tags=recipe.tags,
            image_url=recipe.image_url,
            is_public=recipe.is_public,
            ingredient_count=len(recipe.ingredients),
            created_at=recipe.created_at,
            updated_at=recipe.updated_at,
        )

    # ── CRUD ──────────────────────────────────────────────────────────────────

    async def get_recipes(self, user_id: int) -> List[RecipeSummary]:
        """Return user's own recipes + public seeds."""
        await self.ensure_seeds()
        result = await self.db.execute(
            select(Recipe)
            .where((Recipe.user_id == user_id) | (Recipe.is_public == True))
            .options(selectinload(Recipe.ingredients))
            .order_by(Recipe.is_public.asc(), Recipe.updated_at.desc())
        )
        recipes = result.scalars().all()
        return [self._to_summary(r) for r in recipes]

    async def get_recipe(self, recipe_id: int, user_id: int) -> RecipeRead:
        recipe = await self._get_recipe_or_404(recipe_id, user_id)
        return RecipeRead.model_validate(recipe)

    async def create_recipe(self, user_id: int, data: RecipeCreate) -> RecipeRead:
        recipe = Recipe(
            user_id=user_id,
            title=data.title,
            description=data.description,
            servings=data.servings,
            estimated_minutes=data.estimated_minutes,
            estimated_cost=data.estimated_cost,
            tags=data.tags,
            image_url=data.image_url,
            is_public=False,
        )
        self.db.add(recipe)
        await self.db.flush()

        for pos, ing_data in enumerate(data.ingredients):
            self.db.add(RecipeIngredient(
                recipe_id=recipe.id,
                name=ing_data.name,
                quantity=ing_data.quantity,
                unit=ing_data.unit,
                notes=ing_data.notes,
                product_query=ing_data.product_query,
                position=pos,
            ))

        await self.db.commit()
        await self.db.refresh(recipe)

        # Reload with ingredients
        result = await self.db.execute(
            select(Recipe).where(Recipe.id == recipe.id).options(selectinload(Recipe.ingredients))
        )
        return RecipeRead.model_validate(result.scalar_one())

    async def update_recipe(self, recipe_id: int, user_id: int, data: RecipeUpdate) -> RecipeRead:
        recipe = await self._get_own_recipe_or_404(recipe_id, user_id)

        if data.title is not None:
            recipe.title = data.title
        if data.description is not None:
            recipe.description = data.description
        if data.servings is not None:
            recipe.servings = data.servings
        if data.estimated_minutes is not None:
            recipe.estimated_minutes = data.estimated_minutes
        if data.estimated_cost is not None:
            recipe.estimated_cost = data.estimated_cost
        if data.tags is not None:
            recipe.tags = data.tags
        if data.image_url is not None:
            recipe.image_url = data.image_url

        if data.ingredients is not None:
            # Replace all ingredients
            for ing in list(recipe.ingredients):
                await self.db.delete(ing)
            await self.db.flush()

            for pos, ing_data in enumerate(data.ingredients):
                self.db.add(RecipeIngredient(
                    recipe_id=recipe.id,
                    name=ing_data.name,
                    quantity=ing_data.quantity,
                    unit=ing_data.unit,
                    notes=ing_data.notes,
                    product_query=ing_data.product_query,
                    position=pos,
                ))

        recipe.updated_at = datetime.now(timezone.utc)
        await self.db.commit()

        result = await self.db.execute(
            select(Recipe).where(Recipe.id == recipe.id).options(selectinload(Recipe.ingredients))
        )
        return RecipeRead.model_validate(result.scalar_one())

    async def delete_recipe(self, recipe_id: int, user_id: int) -> None:
        recipe = await self._get_own_recipe_or_404(recipe_id, user_id)
        await self.db.delete(recipe)
        await self.db.commit()

    async def duplicate_recipe(self, recipe_id: int, user_id: int) -> RecipeRead:
        """Copy a recipe (own or public) to the user's collection."""
        source = await self._get_recipe_or_404(recipe_id, user_id)
        data = RecipeCreate(
            title=f"{source.title} (copia)",
            description=source.description,
            servings=source.servings,
            estimated_minutes=source.estimated_minutes,
            estimated_cost=source.estimated_cost,
            tags=source.tags,
            ingredients=[
                type("IngCreate", (), {
                    "name": i.name, "quantity": i.quantity, "unit": i.unit,
                    "notes": i.notes, "product_query": i.product_query, "position": i.position,
                })()
                for i in source.ingredients
            ],
        )
        return await self.create_recipe(user_id, data)

    # ── Add to list ───────────────────────────────────────────────────────────

    async def add_to_list(
        self,
        recipe_id: int,
        user_id: int,
        payload: AddToListPayload,
    ) -> AddToListResult:
        """
        Add recipe ingredients to a shopping list.
        Creates the list if list_id is None.
        Each ingredient becomes a ShoppingListItem (no Mercadona search needed —
        user can search/replace later from ListDetailPage).
        """
        recipe = await self._get_recipe_or_404(recipe_id, user_id)

        # Resolve or create target list
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
            name = payload.new_list_name or f"Lista: {recipe.title}"
            target_list = ShoppingList(user_id=user_id, name=name)
            self.db.add(target_list)
            await self.db.flush()

        added_items = []
        skipped = 0

        for ing in recipe.ingredients:
            try:
                qty = ing.quantity or 1.0
                adjusted_qty = max(1, round(qty * payload.servings_multiplier))

                item = ShoppingListItem(
                    shopping_list_id=target_list.id,
                    product_id=f"recipe_{recipe.id}_ing_{ing.id}",
                    product_name=_format_ingredient_name(ing),
                    product_price=None,
                    product_unit=ing.unit,
                    product_thumbnail=None,
                    product_category=None,
                    quantity=adjusted_qty,
                    is_checked=False,
                    note=ing.notes,
                )
                self.db.add(item)
                added_items.append({"name": item.product_name, "quantity": item.quantity})
            except Exception as e:
                logger.warning(f"Could not add ingredient '{ing.name}': {e}")
                skipped += 1

        await self.db.commit()

        return AddToListResult(
            list_id=target_list.id,
            list_name=target_list.name,
            added=len(added_items),
            skipped=skipped,
            items=added_items,
        )


def _format_ingredient_name(ing: RecipeIngredient) -> str:
    """Format ingredient for display as shopping list item."""
    parts = [ing.name]
    if ing.quantity is not None and ing.unit:
        parts.append(f"({ing.quantity} {ing.unit})")
    elif ing.unit:
        parts.append(f"({ing.unit})")
    return " ".join(parts)
