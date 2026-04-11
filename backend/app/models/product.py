from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, JSON
from datetime import datetime, timezone
from app.db.base import Base


class CatalogProduct(Base):
    """Local product catalog — populated from Mercadona API or imported JSON."""
    __tablename__ = "catalog_products"

    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(300), nullable=False, index=True)
    display_name = Column(String(300), nullable=True)
    price = Column(Float, nullable=True)
    price_instructions = Column(JSON, nullable=True)  # unit_price, bulk_price, etc.
    category = Column(String(200), nullable=True, index=True)
    subcategory = Column(String(200), nullable=True)
    unit_size = Column(String(100), nullable=True)
    thumbnail = Column(String(500), nullable=True)
    photos = Column(JSON, nullable=True)
    is_available = Column(Boolean, default=True, nullable=False)
    source = Column(String(50), default="mercadona_api", nullable=False)  # mercadona_api | local_json | import
    keywords = Column(Text, nullable=True)  # space-separated for simple search
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
