"""
Proxy hacia la API no oficial de Mercadona.
Reutiliza la lógica del server.py original (warehouse mapping, caching, search).
AVISO: Mercadona puede cambiar su API en cualquier momento.
"""
import asyncio
import logging
import time
from typing import Dict, List, Optional, Any

import httpx
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

MERCADONA_API = settings.MERCADONA_API

# Warehouse mapping by postal code prefix (from original server.py)
WAREHOUSES: Dict[str, str] = {
    "28": "mad1",
    "08": "bcn1",
    "41": "svq1",
    "46": "vlc1",
    "29": "mlg1",
    "48": "bil1",
    "50": "zar1",
    "15": "cor1",
    "33": "ovi1",
    "03": "alc1",
    "30": "mur1",
    "07": "pal1",  # Palma de Mallorca
    "18": "grx1",  # Granada
    "23": "jae1",  # Jaén
    "14": "cor2",  # Córdoba
}

# In-memory product cache
_product_cache: Dict[str, List[Dict]] = {}
_cache_timestamp: Dict[str, float] = {}
CACHE_DURATION = 3600  # 1 hour

BASE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "es-ES,es;q=0.9",
}

# Priority categories for search (most common product categories)
PRIORITY_CATEGORIES = [
    72, 53, 54, 37, 38, 40, 62, 59, 60, 64, 69, 78, 77,
    112, 115, 120, 121, 122, 98, 132, 31, 32, 34, 36, 47, 51,
]


def get_warehouse(postal_code: str) -> str:
    prefix = postal_code[:2] if len(postal_code) >= 2 else "28"
    return WAREHOUSES.get(prefix, "mad1")


def _normalize_product(raw: Dict[str, Any], category: Optional[str] = None) -> Dict[str, Any]:
    """Normalize a raw Mercadona product to a consistent shape."""
    price_info = raw.get("price_instructions") or {}
    return {
        "id": str(raw.get("id", "")),
        "name": raw.get("display_name") or raw.get("name") or "",
        "display_name": raw.get("display_name"),
        "price": price_info.get("unit_price") or raw.get("price"),
        "unit_size": price_info.get("unit_size") or raw.get("format"),
        "category": category,
        "thumbnail": raw.get("thumbnail"),
        "photos": raw.get("photos"),
        "price_instructions": price_info,
        "source": "mercadona_api",
    }


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


async def _fetch_category_products(
    client: httpx.AsyncClient, cat_id: int, warehouse: str, query_words: List[str]
) -> List[Dict]:
    """Fetch products from one category and filter by query words."""
    try:
        resp = await client.get(
            f"{MERCADONA_API}/categories/{cat_id}/",
            params={"lang": "es", "wh": warehouse},
            headers=BASE_HEADERS,
        )
        if resp.status_code != 200:
            return []
        data = resp.json()
        results = []
        for subcat in data.get("categories", []):
            cat_name = subcat.get("name")
            for product in subcat.get("products", []):
                name = (product.get("display_name") or product.get("name") or "").lower()
                if all(w in name for w in query_words):
                    results.append(_normalize_product(product, category=cat_name))
        return results
    except Exception as e:
        logger.debug(f"Error fetching category {cat_id}: {e}")
        return []


async def search_products(query: str, postal_code: str = "28001", limit: int = 30) -> List[Dict]:
    """
    Search products using parallel requests to Mercadona categories.
    Falls back gracefully if API is unreachable.
    """
    warehouse = get_warehouse(postal_code)
    query_words = query.lower().split()
    all_results: List[Dict] = []

    async with httpx.AsyncClient(timeout=8.0) as client:
        # Process categories in batches of 5 to avoid overwhelming the API
        for i in range(0, len(PRIORITY_CATEGORIES), 5):
            batch = PRIORITY_CATEGORIES[i : i + 5]
            tasks = [_fetch_category_products(client, cat_id, warehouse, query_words) for cat_id in batch]
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)

            for result in batch_results:
                if isinstance(result, list):
                    all_results.extend(result)

            if len(all_results) >= limit:
                break

    # Deduplicate by product id
    seen = set()
    unique = []
    for p in all_results:
        if p["id"] not in seen:
            seen.add(p["id"])
            unique.append(p)

    return unique[:limit]
