from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class WeeklyPlanDayUpsert(BaseModel):
    day_index: int = Field(ge=0, le=30)
    meal_slot: str = Field(default="comida", pattern="^(desayuno|comida|cena)$")
    recipe_id: Optional[int] = None
    meal_type: Optional[str] = Field(default=None, max_length=50)


class WeeklyPlanCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    people_count: int = Field(default=2, ge=1, le=20)
    days_count: int = Field(default=7, ge=1, le=31)
    start_date: date = Field(default_factory=date.today)
    budget_target: Optional[float] = Field(default=None, ge=0)
    preferences: Optional[dict[str, Any]] = None
    days: list[WeeklyPlanDayUpsert] = []


class WeeklyPlanUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    people_count: Optional[int] = Field(default=None, ge=1, le=20)
    days_count: Optional[int] = Field(default=None, ge=1, le=31)
    start_date: Optional[date] = None
    budget_target: Optional[float] = Field(default=None, ge=0)
    preferences: Optional[dict[str, Any]] = None
    days: Optional[list[WeeklyPlanDayUpsert]] = None


class WeeklyPlanDayRead(BaseModel):
    id: int
    day_index: int
    meal_slot: str
    recipe_id: Optional[int]
    recipe_title: Optional[str] = None
    meal_type: Optional[str]

    class Config:
        from_attributes = True


class WeeklyPlanSummary(BaseModel):
    id: int
    title: str
    people_count: int
    days_count: int
    budget_target: Optional[float]
    assigned_days: int
    created_at: datetime
    updated_at: datetime


class WeeklyPlanRead(BaseModel):
    id: int
    user_id: int
    title: str
    people_count: int
    days_count: int
    start_date: date
    budget_target: Optional[float]
    preferences: Optional[dict[str, Any]]
    created_at: datetime
    updated_at: datetime
    days: list[WeeklyPlanDayRead]


class WeeklyPlanGeneratePayload(BaseModel):
    list_id: Optional[int] = None
    new_list_name: Optional[str] = None
