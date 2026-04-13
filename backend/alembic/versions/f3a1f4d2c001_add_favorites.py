"""add_favorites

Revision ID: f3a1f4d2c001
Revises: 8bbd01dc9b8d
Create Date: 2026-04-12 18:20:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f3a1f4d2c001"
down_revision: Union[str, None] = "8bbd01dc9b8d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "favorite_products",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.String(length=80), nullable=False),
        sa.Column("external_id", sa.String(length=80), nullable=True),
        sa.Column("product_name", sa.String(length=300), nullable=False),
        sa.Column("product_price", sa.Float(), nullable=True),
        sa.Column("product_unit", sa.String(length=120), nullable=True),
        sa.Column("product_thumbnail", sa.String(length=1000), nullable=True),
        sa.Column("product_image", sa.String(length=1000), nullable=True),
        sa.Column("product_category", sa.String(length=200), nullable=True),
        sa.Column("product_subcategory", sa.String(length=200), nullable=True),
        sa.Column("source", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "product_id", name="uq_favorite_products_user_product"),
    )
    op.create_index(op.f("ix_favorite_products_id"), "favorite_products", ["id"], unique=False)
    op.create_index(op.f("ix_favorite_products_user_id"), "favorite_products", ["user_id"], unique=False)
    op.create_index(op.f("ix_favorite_products_product_id"), "favorite_products", ["product_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_favorite_products_product_id"), table_name="favorite_products")
    op.drop_index(op.f("ix_favorite_products_user_id"), table_name="favorite_products")
    op.drop_index(op.f("ix_favorite_products_id"), table_name="favorite_products")
    op.drop_table("favorite_products")
