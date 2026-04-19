from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.pantry import PantryFromListPayload, PantryItemCreate, PantryItemRead, PantryItemUpdate
from app.services.pantry_service import PantryService

router = APIRouter(prefix="/pantry", tags=["pantry"])


@router.get("", response_model=list[PantryItemRead])
async def get_pantry(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await PantryService(db).list_for_user(current_user.id)


@router.post("", response_model=PantryItemRead, status_code=201)
async def add_to_pantry(
    data: PantryItemCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await PantryService(db).create(current_user.id, data)


@router.put("/{item_id}", response_model=PantryItemRead)
async def update_pantry_item(
    item_id: int,
    data: PantryItemUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await PantryService(db).update(current_user.id, item_id, data)


@router.delete("/{item_id}", status_code=204)
async def delete_pantry_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await PantryService(db).delete(current_user.id, item_id)
    return Response(status_code=204)


@router.post("/from-list/{list_id}", response_model=list[PantryItemRead], status_code=201)
async def pantry_from_list(
    list_id: int,
    payload: PantryFromListPayload | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await PantryService(db).from_list(
        current_user.id,
        list_id,
        checked_only=payload.checked_only if payload is not None else True,
    )
