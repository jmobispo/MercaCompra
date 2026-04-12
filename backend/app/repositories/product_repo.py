from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from typing import Optional, List
from app.models.product import CatalogProduct


class ProductRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_external_id(self, external_id: str) -> Optional[CatalogProduct]:
        result = await self.db.execute(
            select(CatalogProduct).where(CatalogProduct.external_id == external_id)
        )
        return result.scalar_one_or_none()

    async def search(self, query: str, category: Optional[str] = None, limit: int = 30) -> List[CatalogProduct]:
        words = query.lower().split()
        stmt = select(CatalogProduct).where(CatalogProduct.is_available == True)

        if category:
            stmt = stmt.where(CatalogProduct.category == category)

        for word in words:
            stmt = stmt.where(CatalogProduct.name.ilike(f"%{word}%"))

        stmt = stmt.limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_categories(self) -> List[str]:
        result = await self.db.execute(
            select(CatalogProduct.category).distinct().where(CatalogProduct.category.is_not(None))
        )
        return [r for (r,) in result.all() if r]

    async def upsert(self, external_id: str, **kwargs) -> CatalogProduct:
        product = await self.get_by_external_id(external_id)
        if product:
            for key, value in kwargs.items():
                setattr(product, key, value)
            await self.db.flush()
            return product
        else:
            product = CatalogProduct(external_id=external_id, **kwargs)
            self.db.add(product)
            await self.db.flush()
            await self.db.refresh(product)
            return product

    async def count(self) -> int:
        from sqlalchemy import func
        result = await self.db.execute(select(func.count()).select_from(CatalogProduct))
        return result.scalar_one()
