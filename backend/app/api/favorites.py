from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.favorite import FavoriteProductCreate, FavoriteProductRead
from app.services.favorite_service import FavoriteService


router = APIRouter(prefix="/favorites", tags=["favorites"])


@router.get("", response_model=list[FavoriteProductRead])
async def list_favorites(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await FavoriteService(db).list_for_user(current_user.id)


@router.post("", response_model=FavoriteProductRead, status_code=201)
async def add_favorite(
    data: FavoriteProductCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await FavoriteService(db).add(current_user.id, data)


@router.delete("/{product_id}", status_code=204)
async def delete_favorite(
    product_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await FavoriteService(db).delete(current_user.id, product_id)
    return Response(status_code=204)
