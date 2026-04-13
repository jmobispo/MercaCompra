from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.db.base import Base


class ShoppingList(Base):
    __tablename__ = "shopping_lists"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False, default="Mi lista")
    budget = Column(Float, nullable=True)  # None = sin límite
    is_archived = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="shopping_lists")
    items = relationship("ShoppingListItem", back_populates="shopping_list", cascade="all, delete-orphan")
    automation_runs = relationship("AutomationRun", back_populates="shopping_list")
    purchase_history = relationship("PurchaseHistory", back_populates="shopping_list")


class ShoppingListItem(Base):
    __tablename__ = "shopping_list_items"

    id = Column(Integer, primary_key=True, index=True)
    shopping_list_id = Column(Integer, ForeignKey("shopping_lists.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(String(50), nullable=False)
    product_name = Column(String(300), nullable=False)
    product_price = Column(Float, nullable=True)
    product_unit = Column(String(100), nullable=True)
    product_thumbnail = Column(String(500), nullable=True)
    product_category = Column(String(200), nullable=True)
    quantity = Column(Integer, default=1, nullable=False)
    is_checked = Column(Boolean, default=False, nullable=False)
    note = Column(Text, nullable=True)
    added_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    shopping_list = relationship("ShoppingList", back_populates="items")
