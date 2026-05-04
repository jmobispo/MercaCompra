from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.shopping_list import ShoppingListRead
from app.schemas.weekly_plan import WeeklyPlanRead


class AIRecipeIngredientDraft(BaseModel):
    name: str
    quantity: Optional[float] = None
    unit: Optional[str] = None
    notes: Optional[str] = None
    product_query: Optional[str] = None


class AIRecipeStepDraft(BaseModel):
    text: str
    position: int = 0


class AIRecipeEnrichPayload(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = None
    servings: int = Field(default=4, ge=1, le=50)
    estimated_minutes: Optional[int] = Field(default=None, ge=1, le=600)
    estimated_cost: Optional[float] = Field(default=None, ge=0)
    calories_per_serving: Optional[float] = Field(default=None, ge=0)
    protein_g: Optional[float] = Field(default=None, ge=0)
    carbs_g: Optional[float] = Field(default=None, ge=0)
    fat_g: Optional[float] = Field(default=None, ge=0)
    fiber_g: Optional[float] = Field(default=None, ge=0)
    sugar_g: Optional[float] = Field(default=None, ge=0)
    sodium_mg: Optional[float] = Field(default=None, ge=0)
    meal_types: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    ingredients: list[AIRecipeIngredientDraft] = Field(default_factory=list)
    steps: list[AIRecipeStepDraft] = Field(default_factory=list)


class AIRecipeEnrichResult(BaseModel):
    description: Optional[str] = None
    estimated_minutes: Optional[int] = None
    estimated_cost: Optional[float] = None
    calories_per_serving: Optional[float] = None
    protein_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fat_g: Optional[float] = None
    fiber_g: Optional[float] = None
    sugar_g: Optional[float] = None
    sodium_mg: Optional[float] = None
    meal_types: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    steps: list[AIRecipeStepDraft] = Field(default_factory=list)
    summary: Optional[str] = None


class AIListOptimizeResult(BaseModel):
    message: str
    applied_changes: int
    shopping_list: ShoppingListRead


class AIWeeklyPlanAssistResult(BaseModel):
    message: str
    applied_slots: int
    weekly_plan: WeeklyPlanRead
