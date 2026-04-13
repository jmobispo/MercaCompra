from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel


class FavoriteProductCreate(BaseModel):
    product_id: str
    external_id: Optional[str] = None
    product_name: str
    product_price: Optional[float] = None
    product_unit: Optional[str] = None
    product_thumbnail: Optional[str] = None
    product_image: Optional[str] = None
    product_category: Optional[str] = None
    product_subcategory: Optional[str] = None
    source: str = "mercadona_api"


class FavoriteProductRead(BaseModel):
    id: int
    user_id: int
    product_id: str
    external_id: Optional[str]
    product_name: str
    product_price: Optional[float]
    product_unit: Optional[str]
    product_thumbnail: Optional[str]
    product_image: Optional[str]
    product_category: Optional[str]
    product_subcategory: Optional[str]
    source: str
    created_at: datetime

    class Config:
        from_attributes = True


class FavoriteListResponse(BaseModel):
    favorites: List[FavoriteProductRead]
