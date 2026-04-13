from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class PurchaseHistoryCreate(BaseModel):
    shopping_list_id: Optional[int] = None
    list_name: str
    estimated_total: float
    item_count: int


class PurchaseHistoryRead(BaseModel):
    id: int
    user_id: int
    shopping_list_id: Optional[int]
    list_name: str
    estimated_total: float
    item_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class SpendingMetrics(BaseModel):
    weekly_current: float
    weekly_previous: float
    weekly_variation: float
    monthly_current: float
    monthly_previous: float
    monthly_variation: float
    total_purchases: int
