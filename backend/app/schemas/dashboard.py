from pydantic import BaseModel
from typing import Optional


class RecentListData(BaseModel):
    id: int
    name: str
    item_count: int
    total: float
    updated_at: str


class SystemStatusData(BaseModel):
    search_mode: str
    ai_mode: str
    postal_code: str
    bot_available: bool
    demo_mode: bool


class DashboardData(BaseModel):
    weekly_spending: float
    weekly_variation: float
    active_list_count: int
    total_pantry_items: int
    recipe_count: int
    favorite_count: int
    recent_list: Optional[RecentListData]
    system_status: SystemStatusData
