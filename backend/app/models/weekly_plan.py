from datetime import date, datetime, timezone

from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db.base import Base


def _now():
    return datetime.now(timezone.utc)


class WeeklyPlan(Base):
    __tablename__ = "weekly_plans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    people_count = Column(Integer, nullable=False, default=2)
    days_count = Column(Integer, nullable=False, default=7)
    start_date = Column(Date, nullable=False, default=date.today)
    budget_target = Column(Float, nullable=True)
    preferences = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)

    user = relationship("User", back_populates="weekly_plans")
    days = relationship(
        "WeeklyPlanDay",
        back_populates="weekly_plan",
        order_by="WeeklyPlanDay.day_index",
        cascade="all, delete-orphan",
    )


class WeeklyPlanDay(Base):
    __tablename__ = "weekly_plan_days"
    __table_args__ = (
        UniqueConstraint("weekly_plan_id", "day_index", "meal_slot", name="uq_weekly_plan_days_plan_day_slot"),
    )

    id = Column(Integer, primary_key=True, index=True)
    weekly_plan_id = Column(Integer, ForeignKey("weekly_plans.id", ondelete="CASCADE"), nullable=False, index=True)
    day_index = Column(Integer, nullable=False)
    meal_slot = Column(String(20), nullable=False, default="comida")
    recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="SET NULL"), nullable=True, index=True)
    meal_type = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)

    weekly_plan = relationship("WeeklyPlan", back_populates="days")
    recipe = relationship("Recipe")
