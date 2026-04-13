from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db.base import Base


def _now():
    return datetime.now(timezone.utc)


class UserProductStats(Base):
    __tablename__ = "user_product_stats"
    __table_args__ = (
        UniqueConstraint("user_id", "product_id", name="uq_user_product_stats_user_product"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(String(80), nullable=False, index=True)
    product_name = Column(String(300), nullable=False)
    product_price = Column(Float, nullable=True)
    product_unit = Column(String(120), nullable=True)
    product_thumbnail = Column(String(1000), nullable=True)
    product_category = Column(String(200), nullable=True)
    source = Column(String(50), nullable=False, default="manual")
    times_added = Column(Integer, nullable=False, default=0)
    last_added_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    average_quantity = Column(Float, nullable=False, default=1.0)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)

    user = relationship("User", back_populates="product_stats")
