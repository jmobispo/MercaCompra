from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.db.base import Base


class AutomationRun(Base):
    __tablename__ = "automation_runs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    shopping_list_id = Column(Integer, ForeignKey("shopping_lists.id", ondelete="SET NULL"), nullable=True, index=True)
    status = Column(String(20), default="pending", nullable=False)
    # pending | running | completed | failed | partial

    # Results summary
    total_items = Column(Integer, default=0)
    added_ok = Column(Integer, default=0)
    not_found = Column(Integer, default=0)
    dubious_match = Column(Integer, default=0)
    substituted = Column(Integer, default=0)
    errors = Column(Integer, default=0)
    estimated_cost = Column(Float, nullable=True)
    duration_seconds = Column(Float, nullable=True)

    error_message = Column(Text, nullable=True)
    item_results = Column(JSON, nullable=True)  # list of AutomationItemResult dicts

    started_at = Column(DateTime(timezone=True), nullable=True)
    finished_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="automation_runs")
    shopping_list = relationship("ShoppingList", back_populates="automation_runs")
