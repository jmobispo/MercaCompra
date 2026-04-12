from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class RecipeIngredientCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    quantity: Optional[float] = None
    unit: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = Field(None, max_length=500)
    product_query: Optional[str] = Field(None, max_length=200)
    position: int = 0


class RecipeIngredientUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    quantity: Optional[float] = None
    unit: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = None
    product_query: Optional[str] = None
    position: Optional[int] = None


class RecipeIngredientRead(BaseModel):
    id: int
    recipe_id: int
    name: str
    quantity: Optional[float]
    unit: Optional[str]
    notes: Optional[str]
    product_query: Optional[str]
    position: int

    class Config:
        from_attributes = True


class RecipeCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    servings: int = Field(default=4, ge=1, le=100)
    estimated_minutes: Optional[int] = Field(None, ge=1)
    estimated_cost: Optional[float] = Field(None, ge=0)
    tags: Optional[List[str]] = None
    image_url: Optional[str] = None
    ingredients: List[RecipeIngredientCreate] = []


class RecipeUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    servings: Optional[int] = Field(None, ge=1, le=100)
    estimated_minutes: Optional[int] = Field(None, ge=1)
    estimated_cost: Optional[float] = Field(None, ge=0)
    tags: Optional[List[str]] = None
    image_url: Optional[str] = None
    ingredients: Optional[List[RecipeIngredientCreate]] = None  # replaces all ingredients


class RecipeRead(BaseModel):
    id: int
    user_id: Optional[int]
    title: str
    description: Optional[str]
    servings: int
    estimated_minutes: Optional[int]
    estimated_cost: Optional[float]
    tags: Optional[List[str]]
    image_url: Optional[str]
    is_public: bool
    ingredients: List[RecipeIngredientRead]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RecipeSummary(BaseModel):
    """Lightweight version for list views."""
    id: int
    user_id: Optional[int]
    title: str
    description: Optional[str]
    servings: int
    estimated_minutes: Optional[int]
    estimated_cost: Optional[float]
    tags: Optional[List[str]]
    image_url: Optional[str]
    is_public: bool
    ingredient_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AddToListPayload(BaseModel):
    """Add recipe ingredients to an existing or new shopping list."""
    list_id: Optional[int] = None           # existing list; creates new if None
    new_list_name: Optional[str] = None     # name for new list (if list_id is None)
    servings_multiplier: float = Field(default=1.0, ge=0.1, le=10.0)


class AddToListResult(BaseModel):
    list_id: int
    list_name: str
    added: int           # ingredients added as items
    skipped: int         # ingredients that failed to add
    items: List[dict]    # brief info on what was added
