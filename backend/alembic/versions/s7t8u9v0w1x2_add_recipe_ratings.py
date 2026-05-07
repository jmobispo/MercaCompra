"""add recipe ratings

Revision ID: s7t8u9v0w1x2
Revises: r6s7t8u9v0w1
Create Date: 2026-05-07
"""

from alembic import op
import sqlalchemy as sa


revision = "s7t8u9v0w1x2"
down_revision = "r6s7t8u9v0w1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "recipe_ratings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("recipe_id", sa.Integer(), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["recipe_id"], ["recipes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "recipe_id", name="uq_recipe_ratings_user_recipe"),
        schema="public",
    )
    op.create_index("ix_recipe_ratings_id", "recipe_ratings", ["id"], unique=False, schema="public")
    op.create_index("ix_recipe_ratings_recipe_id", "recipe_ratings", ["recipe_id"], unique=False, schema="public")
    op.create_index("ix_recipe_ratings_user_id", "recipe_ratings", ["user_id"], unique=False, schema="public")
    op.execute('ALTER TABLE public."recipe_ratings" ENABLE ROW LEVEL SECURITY;')


def downgrade() -> None:
    op.drop_index("ix_recipe_ratings_user_id", table_name="recipe_ratings", schema="public")
    op.drop_index("ix_recipe_ratings_recipe_id", table_name="recipe_ratings", schema="public")
    op.drop_index("ix_recipe_ratings_id", table_name="recipe_ratings", schema="public")
    op.drop_table("recipe_ratings", schema="public")
