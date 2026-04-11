from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.services.list_service import ListService
from app.schemas.shopping_list import (
    ShoppingListCreate, ShoppingListUpdate, ShoppingListRead,
    ShoppingListSummary, ShoppingListItemCreate, ShoppingListItemUpdate,
)

router = APIRouter(prefix="/lists", tags=["lists"])


@router.get("", response_model=List[ShoppingListSummary])
async def get_lists(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = ListService(db)
    return await svc.get_lists(current_user.id)


@router.post("", response_model=ShoppingListRead, status_code=201)
async def create_list(
    data: ShoppingListCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = ListService(db)
    return await svc.create_list(current_user.id, data)


@router.get("/{list_id}", response_model=ShoppingListRead)
async def get_list(
    list_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = ListService(db)
    return await svc.get_list(list_id, current_user.id)


@router.put("/{list_id}", response_model=ShoppingListRead)
async def update_list(
    list_id: int,
    data: ShoppingListUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = ListService(db)
    return await svc.update_list(list_id, current_user.id, data)


@router.delete("/{list_id}", status_code=204)
async def delete_list(
    list_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = ListService(db)
    await svc.delete_list(list_id, current_user.id)


@router.post("/{list_id}/duplicate", response_model=ShoppingListRead, status_code=201)
async def duplicate_list(
    list_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = ListService(db)
    return await svc.duplicate_list(list_id, current_user.id)


# --- Items ---

@router.post("/{list_id}/items", response_model=ShoppingListRead)
async def add_item(
    list_id: int,
    data: ShoppingListItemCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = ListService(db)
    return await svc.add_item(list_id, current_user.id, data)


@router.patch("/{list_id}/items/{item_id}", response_model=ShoppingListRead)
async def update_item(
    list_id: int,
    item_id: int,
    data: ShoppingListItemUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = ListService(db)
    return await svc.update_item(list_id, current_user.id, item_id, data)


@router.delete("/{list_id}/items/{item_id}", response_model=ShoppingListRead)
async def remove_item(
    list_id: int,
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = ListService(db)
    return await svc.remove_item(list_id, current_user.id, item_id)
