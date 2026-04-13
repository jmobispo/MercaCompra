from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.product import (
    CategoryProductsResponse,
    CategoryTreeResponse,
    ProductSearchResult,
    SuggestionRequest,
    SuggestionResult,
)
from app.schemas.habit import AddFrequentProductsPayload, FrequentProductRead
from app.services.habit_service import HabitService
from app.services.product_service import ProductService

router = APIRouter(prefix="/products", tags=["products"])


@router.get("/search", response_model=ProductSearchResult)
async def search_products(
    q: str = Query(..., min_length=2, description="Término de búsqueda"),
    postal_code: str = Query(default="28001"),
    limit: int = Query(default=30, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = ProductService(db)
    return await svc.search(q, postal_code=current_user.postal_code or postal_code, limit=limit)


@router.get("/categories", response_model=CategoryTreeResponse)
async def get_categories(
    postal_code: str = Query(default="28001"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = ProductService(db)
    return await svc.get_categories_tree(current_user.postal_code or postal_code)


@router.get("/by-category/{category_id}", response_model=CategoryProductsResponse)
async def get_products_by_category(
    category_id: int,
    postal_code: str = Query(default="28001"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = ProductService(db)
    return await svc.get_category(category_id, current_user.postal_code or postal_code)


@router.get("/categories/{category_id}", response_model=CategoryProductsResponse)
async def get_category_compat(
    category_id: int,
    postal_code: str = Query(default="28001"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = ProductService(db)
    return await svc.get_category(category_id, current_user.postal_code or postal_code)


@router.post("/suggest", response_model=SuggestionResult)
async def suggest_product(
    data: SuggestionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
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
    svc = ProductService(db)
    suggestions = await svc.compose_suggestions(list_name, items)
    return {"suggestions": suggestions}


@router.get("/frequent", response_model=list[FrequentProductRead])
async def get_frequent_products(
    limit: int = Query(default=12, ge=1, le=24),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await HabitService(db).get_frequent_products(current_user.id, limit=limit)


@router.post("/frequent/add-to-list")
async def add_frequent_products_to_list(
    payload: AddFrequentProductsPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shopping_list = await HabitService(db).add_frequent_products_to_list(
        current_user.id,
        limit=payload.limit,
        list_id=payload.list_id,
        new_list_name=payload.new_list_name,
    )
    return {
        "list_id": shopping_list.id,
        "list_name": shopping_list.name,
        "added": len(shopping_list.items),
    }
