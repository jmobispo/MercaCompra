from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    postal_code = Column(String(10), default="28001", nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    shopping_lists = relationship("ShoppingList", back_populates="user", cascade="all, delete-orphan")
    automation_runs = relationship("AutomationRun", back_populates="user", cascade="all, delete-orphan")
    recipes = relationship("Recipe", back_populates="user", cascade="all, delete-orphan")
    favorite_products = relationship("FavoriteProduct", back_populates="user", cascade="all, delete-orphan")
    purchase_history = relationship("PurchaseHistory", back_populates="user", cascade="all, delete-orphan")
    pantry_items = relationship("PantryItem", back_populates="user", cascade="all, delete-orphan")
