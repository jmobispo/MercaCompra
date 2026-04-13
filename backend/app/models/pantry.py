from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Date, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from app.db.base import Base


class PantryItem(Base):
    __tablename__ = "pantry_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(300), nullable=False)
    product_id = Column(String(80), nullable=True)
    quantity = Column(Float, nullable=False, default=1.0)
    unit = Column(String(100), nullable=True)
    expiry_date = Column(Date, nullable=True)
    is_consumed = Column(Boolean, default=False, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="pantry_items")
