"""
Proxy hacia la API no oficial de Mercadona.
AVISO: Mercadona puede cambiar su API en cualquier momento.

PRODUCT_SEARCH_MODE:
  mercadona  — solo API remota de Mercadona
  fallback   — solo catálogo local JSON
  hybrid     — intenta Mercadona; si devuelve 0 resultados o falla, usa catálogo local
"""
import asyncio
import base64
import logging
import re
import time
from pathlib import Path
from typing import Dict, List, Optional, Any

import httpx
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

MERCADONA_API = settings.MERCADONA_API
MERCADONA_ALGOLIA_APP_ID = settings.MERCADONA_ALGOLIA_APP_ID
MERCADONA_ALGOLIA_API_KEY = settings.MERCADONA_ALGOLIA_API_KEY

# Warehouse mapping by postal code prefix
WAREHOUSES: Dict[str, str] = {
    "28": "mad1", "08": "bcn1", "41": "svq1", "46": "vlc1",
    "29": "mlg1", "48": "bil1", "50": "zar1", "15": "cor1",
    "33": "ovi1", "03": "alc1", "30": "mur1", "07": "pal1",
    "18": "grx1", "23": "jae1", "14": "cor2",
}

BASE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    "Referer": "https://tienda.mercadona.es/",
    "Origin": "https://tienda.mercadona.es",
}

# Priority categories for fallback category search
PRIORITY_CATEGORIES = [
    72, 53, 54, 37, 38, 40, 62, 59, 60, 64, 69, 78, 77,
    112, 115, 120, 121, 122, 98, 132, 31, 32, 34, 36, 47, 51,
]

# ─── Fallback catalog (loaded once) ──────────────────────────────────────────
_FALLBACK_CATALOG: Optional[List[Dict]] = None
_FALLBACK_CATALOG_PATH = Path(__file__).parent.parent.parent.parent.parent / "data" / "catalog" / "fallback.json"
_SEARCH_CACHE: Dict[str, tuple[float, List[Dict]]] = {}
_SEARCH_CACHE_TTL_SECONDS = 300
_DIRECT_SEARCH_AVAILABLE: Optional[bool] = None


def _load_fallback_catalog() -> List[Dict]:
    global _FALLBACK_CATALOG
    if _FALLBACK_CATALOG is not None:
        return _FALLBACK_CATALOG

    import json
    paths_to_try = [
        _FALLBACK_CATALOG_PATH,
        Path("/app/data/catalog/fallback.json"),   # Docker path
        Path(__file__).parent.parent.parent.parent / "data" / "catalog" / "fallback.json",
    ]
    for path in paths_to_try:
        if path.exists():
            try:
                with open(path, "r", encoding="utf-8") as f:
                    _FALLBACK_CATALOG = json.load(f)
                logger.info(f"Loaded fallback catalog: {len(_FALLBACK_CATALOG)} products from {path}")
                return _FALLBACK_CATALOG
            except Exception as e:
                logger.warning(f"Could not load fallback catalog from {path}: {e}")

    logger.warning("No fallback catalog found; searches may return empty when Mercadona API is unavailable")
    _FALLBACK_CATALOG = []
    return _FALLBACK_CATALOG


def _cache_key(query: str, postal_code: str, limit: int, mode: str) -> str:
    return f"{mode}|{postal_code}|{limit}|{query.strip().lower()}"


def _get_cached_search(cache_key: str) -> Optional[List[Dict]]:
    cached = _SEARCH_CACHE.get(cache_key)
    if not cached:
        return None

    ts, items = cached
    if time.time() - ts > _SEARCH_CACHE_TTL_SECONDS:
        _SEARCH_CACHE.pop(cache_key, None)
        return None

    return [dict(item) for item in items]


def _set_cached_search(cache_key: str, items: List[Dict]) -> None:
    _SEARCH_CACHE[cache_key] = (time.time(), [dict(item) for item in items])


def search_fallback_catalog(query: str, limit: int = 30) -> List[Dict]:
    """Search the local fallback catalog with simple word-based matching."""
    catalog = _load_fallback_catalog()
    if not catalog:
        return []

    query_words = _tokenize_query(query)
    if not query_words:
        return []

    scored = []
    for product in catalog:
        name = (product.get("display_name") or product.get("name") or "").lower()
        category = (product.get("category") or "").lower()
        combined = f"{name} {category}"

        # Score: how many query words appear in the product
        matches = sum(1 for w in query_words if w in combined)
        if matches > 0:
            score = matches / len(query_words)
            scored.append((score, product))

    scored.sort(key=lambda x: -x[0])
    return [p for _, p in scored[:limit]]


def _tokenize_query(query: str) -> List[str]:
    """Split query into lowercase tokens, remove accents for better matching."""
    import unicodedata
    normalized = unicodedata.normalize("NFKD", query.lower())
    normalized = "".join(c for c in normalized if not unicodedata.combining(c))
    return [w for w in re.split(r"\W+", normalized) if len(w) >= 2]


def get_warehouse(postal_code: str) -> str:
    prefix = postal_code[:2] if len(postal_code) >= 2 else "28"
    return WAREHOUSES.get(prefix, "mad1")


def _extract_categories(raw: Dict[str, Any]) -> tuple[Optional[str], Optional[str]]:
    categories = raw.get("categories")
    if not isinstance(categories, list) or not categories:
        return raw.get("category"), raw.get("subcategory")

    names: list[str] = []
    current = categories[0]
    while isinstance(current, dict):
        name = current.get("name")
        if name:
            names.append(name)
        children = current.get("categories")
        if isinstance(children, list) and children:
            current = children[0]
            continue
        break

    category = names[0] if names else raw.get("category")
    subcategory = names[-1] if len(names) > 1 else raw.get("subcategory")
    return category, subcategory


def _normalize_product(raw: Dict[str, Any], category: Optional[str] = None) -> Dict[str, Any]:
    price_info = raw.get("price_instructions") or {}
    normalized_category, normalized_subcategory = _extract_categories(raw)
    thumbnail = _extract_thumbnail(raw)
    unit_price = price_info.get("unit_price") or price_info.get("bulk_price") or raw.get("price")
    return {
        "id": str(raw.get("id", "")),
        "external_id": str(raw.get("objectID") or raw.get("id", "")),
        "name": raw.get("display_name") or raw.get("name") or "",
        "display_name": raw.get("display_name"),
        "price": unit_price,
        "unit_size": price_info.get("unit_size") or raw.get("format"),
        "category": category or normalized_category,
        "subcategory": normalized_subcategory,
        "thumbnail": thumbnail,
        "image": thumbnail,
        "photos": raw.get("photos"),
        "price_instructions": price_info,
        "brand": raw.get("brand"),
        "url": raw.get("share_url"),
        "source": "mercadona_api",
    }


def _extract_thumbnail(raw: Dict[str, Any]) -> Optional[str]:
    thumbnail = raw.get("thumbnail")
    if thumbnail:
        return thumbnail

    photos = raw.get("photos")
    if isinstance(photos, list) and photos:
        first = photos[0]
        if isinstance(first, dict):
            return (
                first.get("regular")
                or first.get("zoom")
                or first.get("perspective")
                or first.get("url")
            )
        if isinstance(first, str):
            return first

    return _build_placeholder_thumbnail(
        raw.get("display_name") or raw.get("name") or "Producto",
        raw.get("category") or "Mercadona",
    )


def _build_placeholder_thumbnail(name: str, category: str) -> str:
    initials = "".join(part[0] for part in (name or "P").split()[:2]).upper() or "P"
    safe_category = (category or "Mercadona")[:20]
    svg = f"""
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#e6f7ee"/>
      <stop offset="100%" stop-color="#ccefdc"/>
    </linearGradient>
  </defs>
  <rect width="96" height="96" rx="16" fill="url(#g)"/>
  <circle cx="48" cy="34" r="18" fill="#00a650" opacity="0.18"/>
  <text x="48" y="41" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="700" fill="#007d3c">{initials}</text>
  <text x="48" y="72" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="10" fill="#2f4f3d">{safe_category}</text>
</svg>
""".strip()
    encoded = base64.b64encode(svg.encode("utf-8")).decode("ascii")
    return f"data:image/svg+xml;base64,{encoded}"


# ─── Remote Mercadona API ─────────────────────────────────────────────────────

async def _search_direct(client: httpx.AsyncClient, query: str, warehouse: str) -> List[Dict]:
    """
    Try Mercadona's product search endpoint.
    Returns normalised products, or empty list if endpoint is unavailable.
    """
    global _DIRECT_SEARCH_AVAILABLE
    if _DIRECT_SEARCH_AVAILABLE is False:
        return []

    try:
        resp = await client.get(
            f"{MERCADONA_API}/products/",
            params={"q": query, "lang": "es", "wh": warehouse},
            headers=BASE_HEADERS,
        )
        if resp.status_code == 404:
            _DIRECT_SEARCH_AVAILABLE = False
            logger.info("Mercadona /products devuelve 404; se desactiva la búsqueda directa y se prioriza Algolia")
            return []
        if resp.status_code != 200:
            logger.debug(f"Direct search returned {resp.status_code} for '{query}'")
            return []

        _DIRECT_SEARCH_AVAILABLE = True

        data = resp.json()

        # The search endpoint returns {"items": [...]} or a direct list
        items = data if isinstance(data, list) else data.get("items") or data.get("results") or []

        products = []
        for item in items:
            if isinstance(item, dict):
                products.append(_normalize_product(item))
        return products

    except Exception as e:
        logger.debug(f"Direct product search failed for '{query}': {e}")
        return []


async def _search_algolia(client: httpx.AsyncClient, query: str, warehouse: str, limit: int) -> List[Dict]:
    """
    Try Mercadona's Algolia-backed search endpoint.
    This is often more reliable than /products when Mercadona changes their API.
    """
    if not MERCADONA_ALGOLIA_APP_ID or not MERCADONA_ALGOLIA_API_KEY:
        return []

    index_name = f"products_prod_{warehouse}_es"
    url = (
        f"https://{MERCADONA_ALGOLIA_APP_ID.lower()}-dsn.algolia.net/"
        f"1/indexes/{index_name}/query"
    )
    headers = {
        **BASE_HEADERS,
        "Content-Type": "application/json",
        "x-algolia-application-id": MERCADONA_ALGOLIA_APP_ID,
        "x-algolia-api-key": MERCADONA_ALGOLIA_API_KEY,
    }
    payload = {
        "query": query,
        "hitsPerPage": max(1, min(limit, 50)),
    }

    try:
        resp = await client.post(url, json=payload, headers=headers)
        if resp.status_code != 200:
            logger.debug(f"Algolia search returned {resp.status_code} for '{query}'")
            return []

        data = resp.json()
        hits = data.get("hits") or []
        products = []
        for item in hits:
            if not isinstance(item, dict):
                continue
            normalized = _normalize_product(item, category=item.get("category_name"))
            if normalized.get("name"):
                products.append(normalized)

        if products:
            logger.info(f"Algolia search: {len(products)} results for '{query}'")
        return products
    except Exception as e:
        logger.debug(f"Algolia search failed for '{query}': {e}")
        return []


async def _fetch_category_products(
    client: httpx.AsyncClient, cat_id: int, warehouse: str, query_words: List[str]
) -> List[Dict]:
    """Fetch products from one category and filter by any query word (partial match)."""
    try:
        resp = await client.get(
            f"{MERCADONA_API}/categories/{cat_id}/",
            params={"lang": "es", "wh": warehouse},
            headers=BASE_HEADERS,
        )
        if resp.status_code != 200:
            logger.debug(f"Category {cat_id} returned HTTP {resp.status_code}")
            return []

        data = resp.json()

        # Handle both "categories" and "results" top-level keys
        subcats = data.get("categories") or data.get("results") or []
        if not subcats and isinstance(data, list):
            subcats = data

        results = []
        for subcat in subcats:
            if not isinstance(subcat, dict):
                continue
            cat_name = subcat.get("name")
            products = subcat.get("products") or []
            for product in products:
                name = (product.get("display_name") or product.get("name") or "").lower()
                # Use ANY word match (more results, better recall)
                if any(w in name for w in query_words):
                    results.append(_normalize_product(product, category=cat_name))

        return results

    except Exception as e:
        logger.warning(f"Error fetching category {cat_id}: {type(e).__name__}: {e}")
        return []


async def search_mercadona(query: str, postal_code: str = "28001", limit: int = 30) -> List[Dict]:
    """
    Search Mercadona products:
    1. Try direct search endpoint first (fast)
    2. Fall back to category scan if direct search returns nothing

    Returns empty list (not raises) if API is unreachable.
    """
    warehouse = get_warehouse(postal_code)
    query_words = _tokenize_query(query)

    async with httpx.AsyncClient(timeout=10.0) as client:
        # ── Attempt 1: direct product search ──────────────────────────────
        direct = await _search_direct(client, query, warehouse)
        if direct:
            logger.info(f"Direct search: {len(direct)} results for '{query}'")
            return _deduplicate(direct)[:limit]

        algolia = await _search_algolia(client, query, warehouse, limit=limit)
        if algolia:
            return _deduplicate(algolia)[:limit]

        logger.debug(f"Direct/Algolia search empty for '{query}'; trying category scan")

        # ── Attempt 2: parallel category scan ─────────────────────────────
        all_results: List[Dict] = []
        for i in range(0, len(PRIORITY_CATEGORIES), 5):
            batch = PRIORITY_CATEGORIES[i: i + 5]
            tasks = [
                _fetch_category_products(client, cat_id, warehouse, query_words)
                for cat_id in batch
            ]
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)

            for r in batch_results:
                if isinstance(r, list):
                    all_results.extend(r)

            if len(all_results) >= limit:
                break

        if all_results:
            logger.info(f"Category scan: {len(all_results)} raw results for '{query}'")

        return _deduplicate(all_results)[:limit]


async def _search_mercadona_fast(query: str, postal_code: str = "28001", limit: int = 30) -> List[Dict]:
    """
    Faster remote search path for interactive UI.
    Prefers Algolia because Mercadona's old /products endpoint is now flaky/404.
    """
    warehouse = get_warehouse(postal_code)

    async with httpx.AsyncClient(timeout=3.5) as client:
        algolia = await _search_algolia(client, query, warehouse, limit=limit)
        algolia_results = algolia if isinstance(algolia, list) else []

        if algolia_results:
            return _deduplicate(algolia_results)[:limit]

        direct_results: List[Dict] = []
        if _DIRECT_SEARCH_AVAILABLE is not False:
            direct = await _search_direct(client, query, warehouse)
            direct_results = direct if isinstance(direct, list) else []

        if direct_results:
            return _deduplicate(direct_results)[:limit]

        return []


def _deduplicate(products: List[Dict]) -> List[Dict]:
    seen: set = set()
    unique = []
    for p in products:
        pid = p.get("id") or p.get("name") or ""
        if pid not in seen:
            seen.add(pid)
            unique.append(p)
    return unique


async def search_products(
    query: str,
    postal_code: str = "28001",
    limit: int = 30,
    mode: Optional[str] = None,
) -> List[Dict]:
    """
    Unified search respecting PRODUCT_SEARCH_MODE:
      mercadona  → remote API only
      fallback   → local catalog only
      hybrid     → remote first, fall back to local if no results
    """
    effective_mode = mode or getattr(settings, "PRODUCT_SEARCH_MODE", "hybrid")
    cache_key = _cache_key(query, postal_code, limit, effective_mode)
    cached = _get_cached_search(cache_key)
    if cached is not None:
        return cached

    if effective_mode == "fallback":
        results = search_fallback_catalog(query, limit=limit)
        logger.info(f"Fallback catalog: {len(results)} results for '{query}'")
        for p in results:
            p["source"] = "fallback"
            p["thumbnail"] = p.get("thumbnail") or _build_placeholder_thumbnail(
                p.get("display_name") or p.get("name") or "Producto",
                p.get("category") or "Mercadona",
            )
        _set_cached_search(cache_key, results)
        return results

    if effective_mode == "mercadona":
        try:
            results = await _search_mercadona_fast(query, postal_code, limit)
            _set_cached_search(cache_key, results)
            return results
        except Exception as e:
            logger.error(f"Mercadona search failed for '{query}': {e}", exc_info=True)
            return []

    # hybrid (default)
    try:
        remote = await _search_mercadona_fast(query, postal_code, limit)
    except Exception as e:
        logger.warning(f"Mercadona API error for '{query}': {type(e).__name__}: {e}")
        remote = []

    if remote:
        _set_cached_search(cache_key, remote)
        return remote

    logger.info(f"Mercadona returned 0 results for '{query}'; using fallback catalog")
    fallback = search_fallback_catalog(query, limit=limit)
    for p in fallback:
        p["source"] = "fallback"
        p["thumbnail"] = p.get("thumbnail") or _build_placeholder_thumbnail(
            p.get("display_name") or p.get("name") or "Producto",
            p.get("category") or "Mercadona",
        )
    _set_cached_search(cache_key, fallback)
    return fallback


# ─── Category / product helpers ───────────────────────────────────────────────

async def get_categories(postal_code: str = "28001") -> Dict:
    warehouse = get_warehouse(postal_code)
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            f"{MERCADONA_API}/categories/",
            params={"lang": "es", "wh": warehouse},
            headers=BASE_HEADERS,
        )
        resp.raise_for_status()
        return resp.json()


async def get_category_products(category_id: int, postal_code: str = "28001") -> Dict:
    warehouse = get_warehouse(postal_code)
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            f"{MERCADONA_API}/categories/{category_id}/",
            params={"lang": "es", "wh": warehouse},
            headers=BASE_HEADERS,
        )
        resp.raise_for_status()
        return resp.json()


async def get_product(product_id: str, postal_code: str = "28001") -> Dict:
    warehouse = get_warehouse(postal_code)
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            f"{MERCADONA_API}/products/{product_id}/",
            params={"lang": "es", "wh": warehouse},
            headers=BASE_HEADERS,
        )
        resp.raise_for_status()
        return resp.json()
