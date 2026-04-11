from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


class AutomationItemResultSchema(BaseModel):
    product_id: str
    product_name: str
    quantity: int
    status: str  # ok | not_found | dubious | substituted | error
    matched_name: Optional[str] = None
    matched_price: Optional[float] = None
    substitution_name: Optional[str] = None
    error_detail: Optional[str] = None
    confidence: Optional[float] = None


class AutomationRunCreate(BaseModel):
    shopping_list_id: int
    mercadona_email: Optional[str] = None
    mercadona_password: Optional[str] = None
    headless: bool = True


class AutomationRunRead(BaseModel):
    id: int
    user_id: int
    shopping_list_id: Optional[int]
    status: str
    total_items: int
    added_ok: int
    not_found: int
    dubious_match: int
    substituted: int
    errors: int
    estimated_cost: Optional[float]
    duration_seconds: Optional[float]
    error_message: Optional[str]
    item_results: Optional[List[Any]]
    started_at: Optional[datetime]
    finished_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True
