"""add_purchase_history_and_pantry

Revision ID: c7e2f1a3b084
Revises: f3a1f4d2c001
Create Date: 2026-04-13 10:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c7e2f1a3b084"
down_revision: Union[str, None] = "f3a1f4d2c001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # purchase_history
    op.create_table(
        "purchase_history",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("shopping_list_id", sa.Integer(), nullable=True),
        sa.Column("list_name", sa.String(length=200), nullable=False),
        sa.Column("estimated_total", sa.Float(), nullable=False),
        sa.Column("item_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["shopping_list_id"], ["shopping_lists.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_purchase_history_id"), "purchase_history", ["id"], unique=False)
    op.create_index(op.f("ix_purchase_history_user_id"), "purchase_history", ["user_id"], unique=False)
    op.create_index(op.f("ix_purchase_history_shopping_list_id"), "purchase_history", ["shopping_list_id"], unique=False)

    # pantry_items
    op.create_table(
        "pantry_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=300), nullable=False),
        sa.Column("product_id", sa.String(length=80), nullable=True),
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column("unit", sa.String(length=100), nullable=True),
        sa.Column("expiry_date", sa.Date(), nullable=True),
        sa.Column("is_consumed", sa.Boolean(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_pantry_items_id"), "pantry_items", ["id"], unique=False)
    op.create_index(op.f("ix_pantry_items_user_id"), "pantry_items", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_pantry_items_user_id"), table_name="pantry_items")
    op.drop_index(op.f("ix_pantry_items_id"), table_name="pantry_items")
    op.drop_table("pantry_items")

    op.drop_index(op.f("ix_purchase_history_shopping_list_id"), table_name="purchase_history")
    op.drop_index(op.f("ix_purchase_history_user_id"), table_name="purchase_history")
    op.drop_index(op.f("ix_purchase_history_id"), table_name="purchase_history")
    op.drop_table("purchase_history")
