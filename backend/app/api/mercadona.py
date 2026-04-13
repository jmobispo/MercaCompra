from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.product import CategoryProductsResponse, CategoryTreeResponse
from app.services.product_service import ProductService


router = APIRouter(prefix="/mercadona", tags=["mercadona"])


@router.get("/categories", response_model=CategoryTreeResponse)
async def mercadona_categories(
    postal_code: str = Query(default="28001"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await ProductService(db).get_categories_tree(current_user.postal_code or postal_code)


@router.get("/categories/{category_id}", response_model=CategoryProductsResponse)
async def mercadona_category_products(
    category_id: int,
    postal_code: str = Query(default="28001"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await ProductService(db).get_category(category_id, current_user.postal_code or postal_code)
