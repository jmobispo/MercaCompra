"""
Product service: searches Mercadona API (or fallback catalog), uses AI layer for ranking.
"""
import logging
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.utils.mercadona_proxy import search_products, get_categories, get_category_products
from app.schemas.product import ProductRead, ProductSearchResult, SuggestionResult
from app.services.ai.factory import get_ai_service

logger = logging.getLogger(__name__)
settings = get_settings()


def _to_product_read(raw: dict) -> ProductRead:
    return ProductRead(
        id=str(raw.get("id", "")),
        name=raw.get("name") or raw.get("display_name") or "",
        display_name=raw.get("display_name"),
        price=raw.get("price"),
        unit_size=raw.get("unit_size") or raw.get("format"),
        category=raw.get("category"),
        thumbnail=raw.get("thumbnail"),
        source=raw.get("source", "mercadona_api"),
    )


class ProductService:
    def __init__(self, db: Optional[AsyncSession] = None):
        self.db = db
        self.ai = get_ai_service()

    async def search(self, query: str, postal_code: str = "28001", limit: int = 30) -> ProductSearchResult:
        error_detail: Optional[str] = None
        raw_products: List[dict] = []

        try:
            raw_products = await search_products(
                query,
                postal_code=postal_code,
                limit=limit,
                mode=settings.PRODUCT_SEARCH_MODE,
            )
        except Exception as e:
            error_detail = f"Search error: {type(e).__name__}: {str(e)[:200]}"
            logger.error(f"Product search failed for '{query}': {e}", exc_info=True)

        # Determine if results come from fallback (all have source="fallback")
        source = "fallback" if raw_products and all(
            p.get("source") == "fallback" for p in raw_products
        ) else ("mercadona_api" if raw_products else "none")

        if not raw_products and not error_detail:
            # Genuine empty — Mercadona returned nothing
            logger.info(f"No results found for '{query}' (postal={postal_code}, mode={settings.PRODUCT_SEARCH_MODE})")

        # AI ranking
        try:
            ranked = await self.ai.suggest_products(query, raw_products)
        except Exception as e:
            logger.warning(f"AI ranking failed: {e}")
            ranked = raw_products

        products = [_to_product_read(p) for p in ranked]

        return ProductSearchResult(
            products=products,
            total=len(products),
            query=query,
            source=source,
            error=error_detail,
        )

    async def get_categories_tree(self, postal_code: str = "28001") -> dict:
        try:
            return await get_categories(postal_code)
        except Exception as e:
            logger.error(f"Error fetching categories: {e}")
            return {"results": []}

    async def get_category(self, category_id: int, postal_code: str = "28001") -> dict:
        try:
            return await get_category_products(category_id, postal_code)
        except Exception as e:
            logger.error(f"Error fetching category {category_id}: {e}")
            return {"categories": []}

    async def suggest(
        self,
        product_name: str,
        list_context: Optional[List[str]] = None,
        postal_code: str = "28001",
    ) -> SuggestionResult:
        raw_products = await search_products(product_name, postal_code=postal_code, limit=20)
        ranked = await self.ai.suggest_products(product_name, raw_products, context=list_context)
        products = [_to_product_read(p) for p in ranked[:5]]
        confidence = ranked[0].get("confidence", 0.5) if ranked else 0.0
        return SuggestionResult(
            original=product_name,
            suggestions=products,
            mode=self.ai.mode_name,
            confidence=confidence,
        )

    async def compose_suggestions(self, list_name: str, existing_items: List[str]) -> List[str]:
        return await self.ai.compose_list_suggestions(list_name, existing_items)
