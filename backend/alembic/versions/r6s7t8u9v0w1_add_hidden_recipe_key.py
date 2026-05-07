"""Add recipe_key to hidden recipes

Revision ID: r6s7t8u9v0w1
Revises: p1q2r3s4t5u6
Create Date: 2026-05-07
"""

from alembic import op
import sqlalchemy as sa


revision = "r6s7t8u9v0w1"
down_revision = "p1q2r3s4t5u6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "hidden_recipes",
        sa.Column("recipe_key", sa.String(length=200), nullable=True),
        schema="public",
    )
    op.create_index(
        "ix_hidden_recipes_recipe_key",
        "hidden_recipes",
        ["recipe_key"],
        unique=False,
        schema="public",
    )


def downgrade() -> None:
    op.drop_index("ix_hidden_recipes_recipe_key", table_name="hidden_recipes", schema="public")
    op.drop_column("hidden_recipes", "recipe_key", schema="public")
