from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.services.recipe_service import RecipeService
from app.schemas.recipe import (
    RecipeCreate, RecipeUpdate, RecipeRead, RecipeSummary,
    AddToListPayload, AddToListResult, PantryRecipeSuggestion,
)

router = APIRouter(prefix="/recipes", tags=["recipes"])


@router.get("/suggestions/from-pantry", response_model=List[PantryRecipeSuggestion])
async def pantry_suggestions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return recipes the user can cook based on current pantry contents."""
    svc = RecipeService(db)
    return await svc.from_pantry_suggestions(current_user.id)


@router.get("", response_model=List[RecipeSummary])
async def list_recipes(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List user's own recipes + public seed recipes."""
    svc = RecipeService(db)
    return await svc.get_recipes(current_user.id)


@router.post("", response_model=RecipeRead, status_code=201)
async def create_recipe(
    data: RecipeCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = RecipeService(db)
    return await svc.create_recipe(current_user.id, data)


@router.get("/{recipe_id}", response_model=RecipeRead)
async def get_recipe(
    recipe_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = RecipeService(db)
    return await svc.get_recipe(recipe_id, current_user.id)


@router.put("/{recipe_id}", response_model=RecipeRead)
async def update_recipe(
    recipe_id: int,
    data: RecipeUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = RecipeService(db)
    return await svc.update_recipe(recipe_id, current_user.id, data)


@router.delete("/{recipe_id}", status_code=204)
async def delete_recipe(
    recipe_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = RecipeService(db)
    await svc.delete_recipe(recipe_id, current_user.id)


@router.post("/{recipe_id}/duplicate", response_model=RecipeRead, status_code=201)
async def duplicate_recipe(
    recipe_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Copy a recipe (own or public template) into the user's collection."""
    svc = RecipeService(db)
    return await svc.duplicate_recipe(recipe_id, current_user.id)


@router.post("/{recipe_id}/add-to-list", response_model=AddToListResult)
async def add_to_list(
    recipe_id: int,
    payload: AddToListPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Add recipe ingredients to a shopping list.
    Pass list_id to use an existing list, or new_list_name to create one.
    """
    svc = RecipeService(db)
    return await svc.add_to_list(recipe_id, current_user.id, payload)
