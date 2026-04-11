from pydantic import BaseModel
from typing import Optional, List, Any, Dict


class ProductRead(BaseModel):
    """Normalized product — may come from Mercadona API or local catalog."""
    id: str
    name: str
    display_name: Optional[str] = None
    price: Optional[float] = None
    unit_size: Optional[str] = None
    category: Optional[str] = None
    thumbnail: Optional[str] = None
    source: str = "mercadona_api"

    class Config:
        from_attributes = True


class ProductSearchResult(BaseModel):
    products: List[ProductRead]
    total: int
    query: str


class SuggestionRequest(BaseModel):
    product_name: str
    list_context: Optional[List[str]] = None  # other items in the list


class SuggestionResult(BaseModel):
    original: str
    suggestions: List[ProductRead]
    mode: str  # heuristics | local_free | claude_optional
    confidence: float  # 0.0 - 1.0
