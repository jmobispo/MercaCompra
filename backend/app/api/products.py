from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.services.product_service import ProductService
from app.schemas.product import ProductSearchResult, SuggestionRequest, SuggestionResult

router = APIRouter(prefix="/products", tags=["products"])


@router.get("/search", response_model=ProductSearchResult)
async def search_products(
    q: str = Query(..., min_length=2, description="Término de búsqueda"),
    postal_code: str = Query(default="28001"),
    limit: int = Query(default=30, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Search products in Mercadona with AI-powered ranking."""
    svc = ProductService(db)
    return await svc.search(q, postal_code=current_user.postal_code or postal_code, limit=limit)


@router.get("/categories")
async def get_categories(
    postal_code: str = Query(default="28001"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get Mercadona category tree."""
    svc = ProductService(db)
    return await svc.get_categories_tree(current_user.postal_code or postal_code)


@router.get("/categories/{category_id}")
async def get_category(
    category_id: int,
    postal_code: str = Query(default="28001"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get products in a specific Mercadona category."""
    svc = ProductService(db)
    return await svc.get_category(category_id, current_user.postal_code or postal_code)


@router.post("/suggest", response_model=SuggestionResult)
async def suggest_product(
    data: SuggestionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get AI-powered product suggestions for a given name."""
    svc = ProductService(db)
    return await svc.suggest(
        data.product_name,
        list_context=data.list_context,
        postal_code=current_user.postal_code,
    )


@router.post("/compose-suggestions")
async def compose_list_suggestions(
    list_name: str = Query(...),
    items: List[str] = Query(default=[]),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Suggest complementary products for a shopping list."""
    svc = ProductService(db)
    suggestions = await svc.compose_suggestions(list_name, items)
    return {"suggestions": suggestions}
