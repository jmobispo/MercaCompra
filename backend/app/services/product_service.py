import logging
from typing import List, Optional, Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.schemas.product import (
    CategoryNode,
    CategoryProductsResponse,
    CategoryTreeResponse,
    ProductRead,
    ProductSearchResult,
    SuggestionResult,
)
from app.services.ai.factory import get_ai_service
from app.utils.mercadona_proxy import (
    _build_placeholder_thumbnail,
    get_fallback_categories,
    get_fallback_category_products,
    get_categories,
    get_category_products,
    get_warehouse,
    search_products,
)

logger = logging.getLogger(__name__)
settings = get_settings()
_REMOTE_CATEGORY_NAME_CACHE: dict[str, dict[str, str]] = {}


def _coerce_price(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        candidate = value.strip().replace(",", ".")
        if not candidate:
            return None
        try:
            return float(candidate)
        except ValueError:
            return None
    return None


def _coerce_unit_size(raw: dict) -> Optional[str]:
    price_info = raw.get("price_instructions") or {}
    unit_size = raw.get("unit_size") or raw.get("format") or price_info.get("unit_size")
    size_format = price_info.get("size_format") or price_info.get("reference_format")
    unit_name = price_info.get("unit_name")

    if unit_size is None and not size_format and not unit_name:
        return None

    size_text = str(unit_size).strip() if unit_size is not None else None
    suffix = size_format or unit_name

    if size_text and suffix:
        return f"{size_text} {suffix}".strip()
    if size_text:
        return size_text
    if suffix:
        return str(suffix).strip()
    return None


def _to_product_read(raw: dict, postal_code: str, warehouse: str) -> ProductRead:
    price_info = raw.get("price_instructions") or {}
    price = _coerce_price(
        raw.get("price")
        or price_info.get("unit_price")
        or price_info.get("bulk_price")
        or price_info.get("reference_price")
    )
    thumbnail = raw.get("thumbnail") or raw.get("image")
    if not thumbnail:
        thumbnail = _build_placeholder_thumbnail(
            raw.get("display_name") or raw.get("name") or "Producto",
            raw.get("category") or raw.get("subcategory") or "Mercadona",
        )
    return ProductRead(
        id=str(raw.get("id", "")),
        external_id=str(raw.get("external_id") or raw.get("id", "")),
        name=raw.get("name") or raw.get("display_name") or "",
        display_name=raw.get("display_name"),
        price=price,
        unit_size=_coerce_unit_size(raw),
        category=raw.get("category"),
        subcategory=raw.get("subcategory"),
        thumbnail=thumbnail,
        image=raw.get("image") or thumbnail,
        source=raw.get("source", "mercadona_api"),
        postal_code=postal_code,
        warehouse=warehouse,
    )


def _extract_children(node: Any) -> list[dict]:
    if not isinstance(node, dict):
        return []
    for key in ("categories", "children", "subcategories", "results"):
        value = node.get(key)
        if isinstance(value, list):
            return value
    return []


def _normalize_category_node(node: dict) -> CategoryNode:
    children = [_normalize_category_node(child) for child in _extract_children(node)]
    product_count = len(node.get("products", [])) if isinstance(node.get("products"), list) else 0
    return CategoryNode(
        id=str(node.get("id") or node.get("category_id") or node.get("slug") or node.get("name") or ""),
        name=node.get("name") or node.get("display_name") or "Sin nombre",
        product_count=product_count,
        children=children,
    )


def _normalize_category_tree(raw: Any) -> list[CategoryNode]:
    if isinstance(raw, dict):
        for key in ("results", "categories", "children"):
            if isinstance(raw.get(key), list):
                return [_normalize_category_node(item) for item in raw[key] if isinstance(item, dict)]
    if isinstance(raw, list):
        return [_normalize_category_node(item) for item in raw if isinstance(item, dict)]
    return []


def _cache_category_names(postal_code: str, categories: list[CategoryNode]) -> None:
    cache: dict[str, str] = {}

    def walk(nodes: list[CategoryNode]) -> None:
        for node in nodes:
            cache[str(node.id)] = node.name
            if node.children:
                walk(node.children)

    walk(categories)
    _REMOTE_CATEGORY_NAME_CACHE[postal_code] = cache


def _fallback_category_tree(postal_code: str, warehouse: str) -> CategoryTreeResponse:
    raw = get_fallback_categories()
    categories = _normalize_category_tree(raw)
    return CategoryTreeResponse(
        categories=categories,
        source="fallback",
        error=None,
        warehouse=warehouse,
        postal_code=postal_code,
    )


def _normalize_category_products(raw: Any, postal_code: str, warehouse: str) -> tuple[str, list[ProductRead]]:
    category_name = raw.get("name") if isinstance(raw, dict) else None
    products: list[ProductRead] = []

    def consume_category_block(block: dict) -> None:
        block_name = block.get("name") or block.get("display_name")
        for product in block.get("products", []) or []:
            if isinstance(product, dict):
                if category_name and not product.get("category"):
                    product["category"] = category_name
                if block_name and not product.get("subcategory"):
                    product["subcategory"] = block_name
                products.append(_to_product_read(product, postal_code, warehouse))

    if isinstance(raw, dict):
        if isinstance(raw.get("products"), list):
            consume_category_block(raw)
        for key in ("categories", "results", "children"):
            if isinstance(raw.get(key), list):
                for item in raw[key]:
                    if isinstance(item, dict):
                        consume_category_block(item)
    elif isinstance(raw, list):
        for item in raw:
            if isinstance(item, dict):
                consume_category_block(item)

    deduped: list[ProductRead] = []
    seen: set[str] = set()
    for product in products:
        if product.id in seen:
            continue
        seen.add(product.id)
        deduped.append(product)

    return category_name or "Categoría", deduped


class ProductService:
    def __init__(self, db: Optional[AsyncSession] = None):
        self.db = db
        self.ai = get_ai_service()

    async def search(self, query: str, postal_code: str = "28001", limit: int = 30) -> ProductSearchResult:
        error_detail: Optional[str] = None
        raw_products: List[dict] = []
        warehouse = get_warehouse(postal_code)

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

        source = "fallback" if raw_products and all(
            p.get("source") == "fallback" for p in raw_products
        ) else ("mercadona_api" if raw_products else "none")

        if not raw_products and not error_detail:
            logger.info(f"No results found for '{query}' (postal={postal_code}, mode={settings.PRODUCT_SEARCH_MODE})")

        try:
            ranked = await self.ai.suggest_products(query, raw_products)
        except Exception as e:
            logger.warning(f"AI ranking failed: {e}")
            ranked = raw_products

        products = [_to_product_read(p, postal_code, warehouse) for p in ranked]

        return ProductSearchResult(
            products=products,
            total=len(products),
            query=query,
            source=source,
            error=error_detail,
            warehouse=warehouse,
            postal_code=postal_code,
        )

    async def get_categories_tree(self, postal_code: str = "28001") -> CategoryTreeResponse:
        warehouse = get_warehouse(postal_code)
        try:
            raw = await get_categories(postal_code)
            categories = _normalize_category_tree(raw)
            _cache_category_names(postal_code, categories)
            source = "mercadona_api"
            error = None
        except Exception as e:
            logger.error(f"Error fetching categories: {e}")
            effective_mode = settings.PRODUCT_SEARCH_MODE
            if effective_mode in {"fallback", "hybrid"}:
                fallback_response = _fallback_category_tree(postal_code, warehouse)
                _cache_category_names(postal_code, fallback_response.categories)
                fallback_response.error = f"{type(e).__name__}: {str(e)[:200]}"
                return fallback_response

            categories = []
            source = "none"
            error = f"{type(e).__name__}: {str(e)[:200]}"

        return CategoryTreeResponse(
            categories=categories,
            source=source,
            error=error,
            warehouse=warehouse,
            postal_code=postal_code,
        )

    async def get_category(self, category_id: int, postal_code: str = "28001") -> CategoryProductsResponse:
        warehouse = get_warehouse(postal_code)
        try:
            raw = await get_category_products(category_id, postal_code)
            category_name, products = _normalize_category_products(raw, postal_code, warehouse)
            source = "mercadona_api"
            error = None
        except Exception as e:
            logger.error(f"Error fetching category {category_id}: {e}")
            effective_mode = settings.PRODUCT_SEARCH_MODE
            if effective_mode in {"fallback", "hybrid"}:
                try:
                    raw = get_fallback_category_products(category_id)
                    category_name, products = _normalize_category_products(raw, postal_code, warehouse)
                    source = "fallback"
                    error = f"{type(e).__name__}: {str(e)[:200]}"
                except Exception as fallback_error:
                    remote_name = _REMOTE_CATEGORY_NAME_CACHE.get(postal_code, {}).get(str(category_id))
                    if remote_name:
                        fallback_products = await search_products(
                            remote_name,
                            postal_code=postal_code,
                            limit=50,
                            mode="fallback",
                        )
                        if fallback_products:
                            category_name = remote_name
                            products = [_to_product_read(p, postal_code, warehouse) for p in fallback_products]
                            source = "fallback"
                            error = f"{type(e).__name__}: {str(e)[:200]}"
                        else:
                            logger.error(f"Fallback category {category_id} also failed: {fallback_error}")
                            category_name, products = None, []
                            source = "none"
                            error = f"{type(fallback_error).__name__}: {str(fallback_error)[:200]}"
                    else:
                        logger.error(f"Fallback category {category_id} also failed: {fallback_error}")
                        category_name, products = None, []
                        source = "none"
                        error = f"{type(fallback_error).__name__}: {str(fallback_error)[:200]}"
            else:
                category_name, products = None, []
                source = "none"
                error = f"{type(e).__name__}: {str(e)[:200]}"

        return CategoryProductsResponse(
            category_id=str(category_id),
            category_name=category_name,
            products=products,
            total=len(products),
            source=source,
            error=error,
            warehouse=warehouse,
            postal_code=postal_code,
        )

    async def suggest(
        self,
        product_name: str,
        list_context: Optional[List[str]] = None,
        postal_code: str = "28001",
    ) -> SuggestionResult:
        raw_products = await search_products(product_name, postal_code=postal_code, limit=20)
        ranked = await self.ai.suggest_products(product_name, raw_products, context=list_context)
        warehouse = get_warehouse(postal_code)
        products = [_to_product_read(p, postal_code, warehouse) for p in ranked[:5]]
        confidence = ranked[0].get("confidence", 0.5) if ranked else 0.0
        return SuggestionResult(
            original=product_name,
            suggestions=products,
            mode=self.ai.mode_name,
            confidence=confidence,
        )

    async def compose_suggestions(self, list_name: str, existing_items: List[str]) -> List[str]:
        return await self.ai.compose_list_suggestions(list_name, existing_items)
