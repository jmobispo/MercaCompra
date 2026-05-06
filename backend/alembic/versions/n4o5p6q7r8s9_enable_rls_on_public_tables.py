"""enable rls on public tables

Revision ID: n4o5p6q7r8s9
Revises: m3n4o5p6q7r8
Create Date: 2026-05-06 00:25:00.000000
"""

from typing import Sequence, Union

from alembic import op


revision: str = "n4o5p6q7r8s9"
down_revision: Union[str, Sequence[str], None] = "m3n4o5p6q7r8"
branch_labels = None
depends_on = None


TABLES = [
    "alembic_version",
    "automation_runs",
    "catalog_products",
    "favorite_products",
    "pantry_items",
    "purchase_history",
    "recipe_ingredients",
    "recipes",
    "shopping_list_items",
    "shopping_lists",
    "user_product_stats",
    "users",
    "weekly_plan_days",
    "weekly_plans",
]


def upgrade() -> None:
    for table_name in TABLES:
        op.execute(f'ALTER TABLE public."{table_name}" ENABLE ROW LEVEL SECURITY;')


def downgrade() -> None:
    for table_name in TABLES:
        op.execute(f'ALTER TABLE public."{table_name}" DISABLE ROW LEVEL SECURITY;')
