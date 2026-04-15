from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, List
from datetime import datetime


class RecipeStepBase(BaseModel):
    position: int = Field(default=0, ge=0)
    text: str = Field(..., max_length=500)

    @field_validator("text")
    @classmethod
    def validate_text(cls, value: str) -> str:
        text = value.strip()
        if not text:
            raise ValueError("El texto del paso no puede estar vacio")
        return text


class RecipeStepCreate(RecipeStepBase):
    pass


class RecipeStepRead(RecipeStepBase):
    pass


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
    ingredients: List[RecipeIngredientCreate] = Field(default_factory=list)
    steps: List[RecipeStepCreate] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_steps_count(self):
        if len(self.steps) > 20:
            raise ValueError("Una receta no puede tener mas de 20 pasos")
        return self


class RecipeUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    servings: Optional[int] = Field(None, ge=1, le=100)
    estimated_minutes: Optional[int] = Field(None, ge=1)
    estimated_cost: Optional[float] = Field(None, ge=0)
    tags: Optional[List[str]] = None
    image_url: Optional[str] = None
    ingredients: Optional[List[RecipeIngredientCreate]] = None  # replaces all ingredients
    steps: Optional[List[RecipeStepCreate]] = None

    @model_validator(mode="after")
    def validate_steps_count(self):
        if self.steps is not None and len(self.steps) > 20:
            raise ValueError("Una receta no puede tener mas de 20 pasos")
        return self


class RecipeRead(BaseModel):
    id: int
    user_id: Optional[int]
    title: str
    description: Optional[str]
    servings: int
    estimated_minutes: Optional[int]
    estimated_cost: Optional[float]
    tags: Optional[List[str]]
    steps: List[RecipeStepRead] = Field(default_factory=list)
    image_url: Optional[str]
    is_public: bool
    ingredients: List[RecipeIngredientRead]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

    @field_validator("steps", mode="before")
    @classmethod
    def default_steps(cls, value):
        return value or []


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
    steps: List[RecipeStepRead] = Field(default_factory=list)
    image_url: Optional[str]
    is_public: bool
    ingredient_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

    @field_validator("steps", mode="before")
    @classmethod
    def default_steps(cls, value):
        return value or []


class AddToListPayload(BaseModel):
    """Add recipe ingredients to an existing or new shopping list."""
    list_id: Optional[int] = None
    new_list_name: Optional[str] = None
    servings_multiplier: float = Field(default=1.0, ge=0.1, le=10.0)
    selected_ingredient_ids: Optional[List[int]] = None  # None = add all


class AddToListResult(BaseModel):
    list_id: int
    list_name: str
    added: int
    skipped: int
    items: List[dict]
    resolved_real: int = 0
    resolved_fallback: int = 0
    unresolved: int = 0
    pantry_covered: int = 0
    pantry_reduced: int = 0


class PantryRecipeSuggestion(BaseModel):
    """Recipe suggestion based on pantry contents."""
    recipe: RecipeSummary
    match_pct: float
    matched_count: int
    missing_count: int
    missing_ingredients: List[str]
