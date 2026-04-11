from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class ShoppingListItemCreate(BaseModel):
    product_id: str
    product_name: str
    product_price: Optional[float] = None
    product_unit: Optional[str] = None
    product_thumbnail: Optional[str] = None
    product_category: Optional[str] = None
    quantity: int = Field(default=1, ge=1)
    note: Optional[str] = None


class ShoppingListItemUpdate(BaseModel):
    quantity: Optional[int] = Field(None, ge=0)
    is_checked: Optional[bool] = None
    note: Optional[str] = None


class ShoppingListItemRead(BaseModel):
    id: int
    product_id: str
    product_name: str
    product_price: Optional[float]
    product_unit: Optional[str]
    product_thumbnail: Optional[str]
    product_category: Optional[str]
    quantity: int
    is_checked: bool
    note: Optional[str]
    added_at: datetime

    class Config:
        from_attributes = True


class ShoppingListCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    budget: Optional[float] = Field(None, gt=0)


class ShoppingListUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    budget: Optional[float] = Field(None, gt=0)


class ShoppingListRead(BaseModel):
    id: int
    user_id: int
    name: str
    budget: Optional[float]
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    items: List[ShoppingListItemRead] = []

    class Config:
        from_attributes = True

    @property
    def total(self) -> float:
        return sum(
            (item.product_price or 0) * item.quantity
            for item in self.items
        )

    @property
    def remaining(self) -> Optional[float]:
        if self.budget is None:
            return None
        return self.budget - self.total


class ShoppingListSummary(BaseModel):
    id: int
    name: str
    budget: Optional[float]
    is_archived: bool
    item_count: int
    total: float
    updated_at: datetime

    class Config:
        from_attributes = True
