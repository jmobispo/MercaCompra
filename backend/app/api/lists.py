from typing import List

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.shopping_list import (
    ListOptimizationApplyPayload,
    ListOptimizationPreview,
    ShoppingListCreate,
    ShoppingListItemCreate,
    ShoppingListItemRead,
    ShoppingListItemUpdate,
    ShoppingListRead,
    ShoppingListSummary,
    ShoppingListUpdate,
)
from app.services.list_service import ListService


class SupermarketGroup(BaseModel):
    category: str
    items: List[ShoppingListItemRead]


class SupermarketView(BaseModel):
    list_id: int
    list_name: str
    groups: List[SupermarketGroup]
    total_items: int
    checked_items: int


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


@router.get("/{list_id}/supermarket", response_model=SupermarketView)
async def get_supermarket_view(
    list_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = ListService(db)
    sl = await svc.get_list(list_id, current_user.id)

    groups: dict[str, list[ShoppingListItemRead]] = {}
    for item in sl.items:
        cat = item.product_category or "Sin categoría"
        groups.setdefault(cat, []).append(item)

    sorted_groups = [
        SupermarketGroup(category=cat, items=items)
        for cat, items in sorted(groups.items())
    ]

    return SupermarketView(
        list_id=sl.id,
        list_name=sl.name,
        groups=sorted_groups,
        total_items=len(sl.items),
        checked_items=sum(1 for i in sl.items if i.is_checked),
    )


@router.post("/{list_id}/optimize", response_model=ListOptimizationPreview)
async def optimize_list_preview(
    list_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = ListService(db)
    preview = await svc.optimize_list_preview(list_id, current_user.id)
    return ListOptimizationPreview.model_validate(preview)


@router.post("/{list_id}/optimize/apply", response_model=ShoppingListRead)
async def apply_list_optimization(
    list_id: int,
    payload: ListOptimizationApplyPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = ListService(db)
    return await svc.apply_optimization(list_id, current_user.id, payload.suggestion_ids)
