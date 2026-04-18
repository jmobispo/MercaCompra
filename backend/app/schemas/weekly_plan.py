from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class WeeklyPlanPreferences(BaseModel):
    economico: bool = False
    rapido: bool = False
    saludable: bool = False
    familiar: bool = False


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
    preferences: Optional[WeeklyPlanPreferences] = None
    days: list[WeeklyPlanDayUpsert] = []


class WeeklyPlanUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    people_count: Optional[int] = Field(default=None, ge=1, le=20)
    days_count: Optional[int] = Field(default=None, ge=1, le=31)
    start_date: Optional[date] = None
    budget_target: Optional[float] = Field(default=None, ge=0)
    preferences: Optional[WeeklyPlanPreferences] = None
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
    preferences: WeeklyPlanPreferences
    created_at: datetime
    updated_at: datetime
    days: list[WeeklyPlanDayRead]


class WeeklyPlanGeneratePayload(BaseModel):
    list_id: Optional[int] = None
    new_list_name: Optional[str] = None


class WeeklyPlanMealSummary(BaseModel):
    meal_slot: str
    recipe_id: Optional[int]
    recipe_title: Optional[str] = None
    calories: float = 0
    protein_g: float = 0
    carbs_g: float = 0
    fat_g: float = 0
    estimated_cost: float = 0
    meal_types: list[str] = Field(default_factory=list)


class WeeklyPlanDaySummaryRead(BaseModel):
    day_index: int
    date: date
    estimated_day_cost: float = 0
    estimated_day_calories: float = 0
    protein_g: float = 0
    carbs_g: float = 0
    fat_g: float = 0
    meals: list[WeeklyPlanMealSummary] = Field(default_factory=list)


class WeeklyPlanSummaryRead(BaseModel):
    plan_id: int
    title: str
    people_count: int
    days_count: int
    budget_target: Optional[float]
    preferences: WeeklyPlanPreferences
    total_estimated_cost: float = 0
    total_estimated_calories: float = 0
    total_protein_g: float = 0
    total_carbs_g: float = 0
    total_fat_g: float = 0
    average_daily_calories: float = 0
    average_daily_cost: float = 0
    budget_remaining: Optional[float] = None
    within_budget: Optional[bool] = None
    days: list[WeeklyPlanDaySummaryRead] = Field(default_factory=list)
