"""add_weekly_plans_and_habits

Revision ID: 1c2d3e4f5a6b
Revises: f3a1f4d2c001
Create Date: 2026-04-13 18:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "1c2d3e4f5a6b"
down_revision: Union[str, None] = "f3a1f4d2c001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "weekly_plans",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("people_count", sa.Integer(), nullable=False),
        sa.Column("days_count", sa.Integer(), nullable=False),
        sa.Column("budget_target", sa.Float(), nullable=True),
        sa.Column("preferences", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_weekly_plans_id"), "weekly_plans", ["id"], unique=False)
    op.create_index(op.f("ix_weekly_plans_user_id"), "weekly_plans", ["user_id"], unique=False)

    op.create_table(
        "weekly_plan_days",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("weekly_plan_id", sa.Integer(), nullable=False),
        sa.Column("day_index", sa.Integer(), nullable=False),
        sa.Column("recipe_id", sa.Integer(), nullable=True),
        sa.Column("meal_type", sa.String(length=50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["recipe_id"], ["recipes.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["weekly_plan_id"], ["weekly_plans.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("weekly_plan_id", "day_index", name="uq_weekly_plan_days_plan_day"),
    )
    op.create_index(op.f("ix_weekly_plan_days_id"), "weekly_plan_days", ["id"], unique=False)
    op.create_index(op.f("ix_weekly_plan_days_recipe_id"), "weekly_plan_days", ["recipe_id"], unique=False)
    op.create_index(op.f("ix_weekly_plan_days_weekly_plan_id"), "weekly_plan_days", ["weekly_plan_id"], unique=False)

    op.create_table(
        "user_product_stats",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.String(length=80), nullable=False),
        sa.Column("product_name", sa.String(length=300), nullable=False),
        sa.Column("product_price", sa.Float(), nullable=True),
        sa.Column("product_unit", sa.String(length=120), nullable=True),
        sa.Column("product_thumbnail", sa.String(length=1000), nullable=True),
        sa.Column("product_category", sa.String(length=200), nullable=True),
        sa.Column("source", sa.String(length=50), nullable=False),
        sa.Column("times_added", sa.Integer(), nullable=False),
        sa.Column("last_added_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("average_quantity", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "product_id", name="uq_user_product_stats_user_product"),
    )
    op.create_index(op.f("ix_user_product_stats_id"), "user_product_stats", ["id"], unique=False)
    op.create_index(op.f("ix_user_product_stats_product_id"), "user_product_stats", ["product_id"], unique=False)
    op.create_index(op.f("ix_user_product_stats_user_id"), "user_product_stats", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_user_product_stats_user_id"), table_name="user_product_stats")
    op.drop_index(op.f("ix_user_product_stats_product_id"), table_name="user_product_stats")
    op.drop_index(op.f("ix_user_product_stats_id"), table_name="user_product_stats")
    op.drop_table("user_product_stats")

    op.drop_index(op.f("ix_weekly_plan_days_weekly_plan_id"), table_name="weekly_plan_days")
    op.drop_index(op.f("ix_weekly_plan_days_recipe_id"), table_name="weekly_plan_days")
    op.drop_index(op.f("ix_weekly_plan_days_id"), table_name="weekly_plan_days")
    op.drop_table("weekly_plan_days")

    op.drop_index(op.f("ix_weekly_plans_user_id"), table_name="weekly_plans")
    op.drop_index(op.f("ix_weekly_plans_id"), table_name="weekly_plans")
    op.drop_table("weekly_plans")
