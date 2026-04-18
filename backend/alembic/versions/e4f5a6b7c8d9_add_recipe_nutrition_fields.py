"""add_recipe_nutrition_fields

Revision ID: e4f5a6b7c8d9
Revises: a1b2c3d4e5f6
Create Date: 2026-04-18 10:30:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e4f5a6b7c8d9"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("recipes", sa.Column("calories_per_serving", sa.Float(), nullable=True))
    op.add_column("recipes", sa.Column("protein_g", sa.Float(), nullable=True))
    op.add_column("recipes", sa.Column("carbs_g", sa.Float(), nullable=True))
    op.add_column("recipes", sa.Column("fat_g", sa.Float(), nullable=True))
    op.add_column("recipes", sa.Column("fiber_g", sa.Float(), nullable=True))
    op.add_column("recipes", sa.Column("sugar_g", sa.Float(), nullable=True))
    op.add_column("recipes", sa.Column("sodium_mg", sa.Float(), nullable=True))
    op.add_column("recipes", sa.Column("meal_types", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("recipes", "meal_types")
    op.drop_column("recipes", "sodium_mg")
    op.drop_column("recipes", "sugar_g")
    op.drop_column("recipes", "fiber_g")
    op.drop_column("recipes", "fat_g")
    op.drop_column("recipes", "carbs_g")
    op.drop_column("recipes", "protein_g")
    op.drop_column("recipes", "calories_per_serving")
