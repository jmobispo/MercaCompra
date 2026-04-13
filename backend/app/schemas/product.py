from typing import Optional, List

from pydantic import BaseModel


class ProductRead(BaseModel):
    """Normalized product that can come from Mercadona API or local fallback."""

    id: str
    external_id: Optional[str] = None
    name: str
    display_name: Optional[str] = None
    price: Optional[float] = None
    unit_size: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    thumbnail: Optional[str] = None
    image: Optional[str] = None
    source: str = "mercadona_api"
    postal_code: Optional[str] = None
    warehouse: Optional[str] = None

    class Config:
        from_attributes = True


class ProductSearchResult(BaseModel):
    products: List[ProductRead]
    total: int
    query: str
    source: str = "mercadona_api"
    error: Optional[str] = None
    warehouse: Optional[str] = None
    postal_code: Optional[str] = None


class CategoryNode(BaseModel):
    id: str
    name: str
    product_count: int = 0
    children: List["CategoryNode"] = []


class CategoryTreeResponse(BaseModel):
    categories: List[CategoryNode]
    source: str = "mercadona_api"
    error: Optional[str] = None
    warehouse: Optional[str] = None
    postal_code: Optional[str] = None


class CategoryProductsResponse(BaseModel):
    category_id: str
    category_name: Optional[str] = None
    products: List[ProductRead]
    total: int
    source: str = "mercadona_api"
    error: Optional[str] = None
    warehouse: Optional[str] = None
    postal_code: Optional[str] = None


class SuggestionRequest(BaseModel):
    product_name: str
    list_context: Optional[List[str]] = None


class SuggestionResult(BaseModel):
    original: str
    suggestions: List[ProductRead]
    mode: str
    confidence: float


CategoryNode.model_rebuild()
