from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
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
from app.utils.recipe_images import (
    ALLOWED_RECIPE_IMAGE_TYPES,
    MAX_RECIPE_IMAGE_BYTES,
    delete_recipe_image_file,
    generate_recipe_image_filename,
    save_recipe_image_bytes,
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


@router.post("/{recipe_id}/image", response_model=RecipeRead)
async def upload_recipe_image(
    recipe_id: int,
    image: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if image.content_type not in ALLOWED_RECIPE_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de imagen no permitido. Usa JPG, PNG, WEBP o GIF.",
        )

    content = await image.read()
    await image.close()

    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La imagen esta vacia.")
    if len(content) > MAX_RECIPE_IMAGE_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La imagen supera el maximo de 5 MB.")

    filename = generate_recipe_image_filename(image.content_type)
    image_url = save_recipe_image_bytes(filename, content)
    svc = RecipeService(db)

    try:
        return await svc.set_recipe_image(recipe_id, current_user.id, image_url)
    except Exception:
        delete_recipe_image_file(image_url)
        raise


@router.delete("/{recipe_id}/image", response_model=RecipeRead)
async def delete_recipe_image(
    recipe_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = RecipeService(db)
    return await svc.delete_recipe_image(recipe_id, current_user.id)


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
