from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.favorite import FavoriteProduct
from app.schemas.favorite import FavoriteProductCreate, FavoriteProductRead


class FavoriteService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_for_user(self, user_id: int) -> list[FavoriteProductRead]:
        result = await self.db.execute(
            select(FavoriteProduct)
            .where(FavoriteProduct.user_id == user_id)
            .order_by(FavoriteProduct.created_at.desc())
        )
        return [FavoriteProductRead.model_validate(item) for item in result.scalars().all()]

    async def add(self, user_id: int, data: FavoriteProductCreate) -> FavoriteProductRead:
        result = await self.db.execute(
            select(FavoriteProduct).where(
                FavoriteProduct.user_id == user_id,
                FavoriteProduct.product_id == data.product_id,
            )
        )
        favorite = result.scalar_one_or_none()

        payload = data.model_dump()
        if favorite:
            for key, value in payload.items():
                setattr(favorite, key, value)
        else:
            favorite = FavoriteProduct(user_id=user_id, **payload)
            self.db.add(favorite)

        await self.db.commit()
        await self.db.refresh(favorite)
        return FavoriteProductRead.model_validate(favorite)

    async def delete(self, user_id: int, product_id: str) -> None:
        result = await self.db.execute(
            select(FavoriteProduct).where(
                FavoriteProduct.user_id == user_id,
                FavoriteProduct.product_id == product_id,
            )
        )
        favorite = result.scalar_one_or_none()
        if not favorite:
            raise HTTPException(status_code=404, detail="Favorito no encontrado")

        await self.db.delete(favorite)
        await self.db.commit()
