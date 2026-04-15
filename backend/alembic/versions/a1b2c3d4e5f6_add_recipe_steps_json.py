"""add_recipe_steps_json

Revision ID: a1b2c3d4e5f6
Revises: 2b4c6d8e9f10, d9a1e2b3c4f5
Create Date: 2026-04-15 20:20:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, tuple[str, str], None] = ("2b4c6d8e9f10", "d9a1e2b3c4f5")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("recipes", sa.Column("steps", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("recipes", "steps")
