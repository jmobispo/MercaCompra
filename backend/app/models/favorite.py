from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from app.db.base import Base


class FavoriteProduct(Base):
    __tablename__ = "favorite_products"
    __table_args__ = (
        UniqueConstraint("user_id", "product_id", name="uq_favorite_products_user_product"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(String(80), nullable=False, index=True)
    external_id = Column(String(80), nullable=True)
    product_name = Column(String(300), nullable=False)
    product_price = Column(Float, nullable=True)
    product_unit = Column(String(120), nullable=True)
    product_thumbnail = Column(String(1000), nullable=True)
    product_image = Column(String(1000), nullable=True)
    product_category = Column(String(200), nullable=True)
    product_subcategory = Column(String(200), nullable=True)
    source = Column(String(50), nullable=False, default="mercadona_api")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="favorite_products")
