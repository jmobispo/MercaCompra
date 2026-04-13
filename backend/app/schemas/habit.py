from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class FrequentProductRead(BaseModel):
    product_id: str
    product_name: str
    product_price: Optional[float]
    product_unit: Optional[str]
    product_thumbnail: Optional[str]
    product_category: Optional[str]
    source: str
    times_added: int
    last_added_at: datetime
    average_quantity: float

    class Config:
        from_attributes = True


class AddFrequentProductsPayload(BaseModel):
    list_id: Optional[int] = None
    new_list_name: Optional[str] = None
    limit: int = 6
