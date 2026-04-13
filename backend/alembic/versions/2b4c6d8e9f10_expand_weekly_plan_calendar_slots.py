"""expand_weekly_plan_calendar_slots

Revision ID: 2b4c6d8e9f10
Revises: 1c2d3e4f5a6b
Create Date: 2026-04-13 22:40:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "2b4c6d8e9f10"
down_revision: Union[str, None] = "1c2d3e4f5a6b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("weekly_plans", sa.Column("start_date", sa.Date(), nullable=True))
    op.execute("UPDATE weekly_plans SET start_date = date(created_at)")
    with op.batch_alter_table("weekly_plans") as batch_op:
        batch_op.alter_column("start_date", nullable=False)

    op.create_table(
        "weekly_plan_days_new",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("weekly_plan_id", sa.Integer(), nullable=False),
        sa.Column("day_index", sa.Integer(), nullable=False),
        sa.Column("meal_slot", sa.String(length=20), nullable=False),
        sa.Column("recipe_id", sa.Integer(), nullable=True),
        sa.Column("meal_type", sa.String(length=50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["recipe_id"], ["recipes.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["weekly_plan_id"], ["weekly_plans.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("weekly_plan_id", "day_index", "meal_slot", name="uq_weekly_plan_days_plan_day_slot"),
    )
    op.create_index("ix_weekly_plan_days_new_id", "weekly_plan_days_new", ["id"], unique=False)
    op.create_index("ix_weekly_plan_days_new_recipe_id", "weekly_plan_days_new", ["recipe_id"], unique=False)
    op.create_index("ix_weekly_plan_days_new_weekly_plan_id", "weekly_plan_days_new", ["weekly_plan_id"], unique=False)

    op.execute(
        """
        INSERT INTO weekly_plan_days_new
        (id, weekly_plan_id, day_index, meal_slot, recipe_id, meal_type, created_at, updated_at)
        SELECT id, weekly_plan_id, day_index, 'comida', recipe_id, meal_type, created_at, updated_at
        FROM weekly_plan_days
        """
    )

    op.drop_index("ix_weekly_plan_days_weekly_plan_id", table_name="weekly_plan_days")
    op.drop_index("ix_weekly_plan_days_recipe_id", table_name="weekly_plan_days")
    op.drop_index("ix_weekly_plan_days_id", table_name="weekly_plan_days")
    op.drop_table("weekly_plan_days")

    op.rename_table("weekly_plan_days_new", "weekly_plan_days")
    op.create_index(op.f("ix_weekly_plan_days_id"), "weekly_plan_days", ["id"], unique=False)
    op.create_index(op.f("ix_weekly_plan_days_recipe_id"), "weekly_plan_days", ["recipe_id"], unique=False)
    op.create_index(op.f("ix_weekly_plan_days_weekly_plan_id"), "weekly_plan_days", ["weekly_plan_id"], unique=False)


def downgrade() -> None:
    op.create_table(
        "weekly_plan_days_old",
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
    op.create_index("ix_weekly_plan_days_old_id", "weekly_plan_days_old", ["id"], unique=False)
    op.create_index("ix_weekly_plan_days_old_recipe_id", "weekly_plan_days_old", ["recipe_id"], unique=False)
    op.create_index("ix_weekly_plan_days_old_weekly_plan_id", "weekly_plan_days_old", ["weekly_plan_id"], unique=False)

    op.execute(
        """
        INSERT INTO weekly_plan_days_old
        (id, weekly_plan_id, day_index, recipe_id, meal_type, created_at, updated_at)
        SELECT id, weekly_plan_id, day_index, recipe_id, meal_type, created_at, updated_at
        FROM weekly_plan_days
        WHERE meal_slot = 'comida'
        """
    )

    op.drop_index(op.f("ix_weekly_plan_days_weekly_plan_id"), table_name="weekly_plan_days")
    op.drop_index(op.f("ix_weekly_plan_days_recipe_id"), table_name="weekly_plan_days")
    op.drop_index(op.f("ix_weekly_plan_days_id"), table_name="weekly_plan_days")
    op.drop_table("weekly_plan_days")
    op.rename_table("weekly_plan_days_old", "weekly_plan_days")
    op.create_index(op.f("ix_weekly_plan_days_id"), "weekly_plan_days", ["id"], unique=False)
    op.create_index(op.f("ix_weekly_plan_days_recipe_id"), "weekly_plan_days", ["recipe_id"], unique=False)
    op.create_index(op.f("ix_weekly_plan_days_weekly_plan_id"), "weekly_plan_days", ["weekly_plan_id"], unique=False)

    with op.batch_alter_table("weekly_plans") as batch_op:
        batch_op.drop_column("start_date")
