from datetime import datetime, date
from typing import Optional

from pydantic import BaseModel, Field


class PantryItemCreate(BaseModel):
    name: str
    product_id: Optional[str] = None
    quantity: float = Field(default=1.0, gt=0)
    unit: Optional[str] = None
    expiry_date: Optional[date] = None
    notes: Optional[str] = None


class PantryItemUpdate(BaseModel):
    name: Optional[str] = None
    quantity: Optional[float] = Field(default=None, gt=0)
    unit: Optional[str] = None
    expiry_date: Optional[date] = None
    is_consumed: Optional[bool] = None
    notes: Optional[str] = None


class PantryFromListPayload(BaseModel):
    checked_only: bool = True


class PantryItemRead(BaseModel):
    id: int
    user_id: int
    name: str
    product_id: Optional[str]
    quantity: float
    unit: Optional[str]
    expiry_date: Optional[date]
    is_consumed: bool
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
