"""Recipe and RecipeIngredient models."""
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey,
    Integer, JSON, String, Text,
)
from sqlalchemy.orm import relationship
from app.db.base import Base


def _now():
    return datetime.now(timezone.utc)


class Recipe(Base):
    __tablename__ = "recipes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)

    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    servings = Column(Integer, default=4)
    estimated_minutes = Column(Integer, nullable=True)
    estimated_cost = Column(Float, nullable=True)
    tags = Column(JSON, nullable=True)          # list[str]
    steps = Column(JSON, nullable=True)         # list[{position:int,text:str}]
    image_url = Column(String(500), nullable=True)
    is_public = Column(Boolean, default=False, nullable=False)   # True for seed/template recipes

    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)

    user = relationship("User", back_populates="recipes")
    ingredients = relationship(
        "RecipeIngredient",
        back_populates="recipe",
        order_by="RecipeIngredient.position",
        cascade="all, delete-orphan",
    )


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id = Column(Integer, primary_key=True, index=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String(200), nullable=False)
    quantity = Column(Float, nullable=True)
    unit = Column(String(50), nullable=True)
    notes = Column(String(500), nullable=True)
    product_query = Column(String(200), nullable=True)  # hint for Mercadona search
    position = Column(Integer, default=0, nullable=False)

    recipe = relationship("Recipe", back_populates="ingredients")
