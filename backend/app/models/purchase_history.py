from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from app.db.base import Base


class PurchaseHistory(Base):
    __tablename__ = "purchase_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    shopping_list_id = Column(Integer, ForeignKey("shopping_lists.id", ondelete="SET NULL"), nullable=True, index=True)
    list_name = Column(String(200), nullable=False)
    estimated_total = Column(Float, nullable=False, default=0.0)
    item_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="purchase_history")
    shopping_list = relationship("ShoppingList", back_populates="purchase_history")
