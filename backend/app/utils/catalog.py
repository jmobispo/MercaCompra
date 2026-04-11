"""
Catalog utilities: load local JSON catalog, import products to DB.
Supports multiple sources: local_json, mercadona_api, import.
"""
import json
import logging
from pathlib import Path
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent.parent.parent / "data" / "catalog"


def load_local_catalog() -> List[Dict[str, Any]]:
    """Load products from local JSON files in data/catalog/."""
    products = []
    if not DATA_DIR.exists():
        logger.info("No local catalog directory found")
        return products

    for json_file in DATA_DIR.glob("*.json"):
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    products.extend(data)
                elif isinstance(data, dict) and "products" in data:
                    products.extend(data["products"])
            logger.info(f"Loaded {len(products)} products from {json_file.name}")
        except Exception as e:
            logger.error(f"Error loading {json_file}: {e}")

    return products


def normalize_local_product(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize a product from local JSON to CatalogProduct fields."""
    return {
        "external_id": str(raw.get("id") or raw.get("external_id", "")),
        "name": raw.get("name") or raw.get("display_name") or "",
        "display_name": raw.get("display_name"),
        "price": raw.get("price"),
        "price_instructions": raw.get("price_instructions"),
        "category": raw.get("category"),
        "subcategory": raw.get("subcategory"),
        "unit_size": raw.get("unit_size") or raw.get("format"),
        "thumbnail": raw.get("thumbnail"),
        "photos": raw.get("photos"),
        "is_available": raw.get("is_available", True),
        "source": raw.get("source", "local_json"),
        "keywords": raw.get("keywords"),
    }
