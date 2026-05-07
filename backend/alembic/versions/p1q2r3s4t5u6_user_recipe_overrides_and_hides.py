"""Add user recipe overrides and hidden public recipes

Revision ID: p1q2r3s4t5u6
Revises: n4o5p6q7r8s9
Create Date: 2026-05-07
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "p1q2r3s4t5u6"
down_revision = "n4o5p6q7r8s9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "recipes",
        sa.Column("source_recipe_id", sa.Integer(), nullable=True),
        schema="public",
    )
    op.create_index(
        "ix_recipes_source_recipe_id",
        "recipes",
        ["source_recipe_id"],
        unique=False,
        schema="public",
    )
    op.create_foreign_key(
        "fk_recipes_source_recipe_id_recipes",
        "recipes",
        "recipes",
        ["source_recipe_id"],
        ["id"],
        source_schema="public",
        referent_schema="public",
        ondelete="SET NULL",
    )

    op.create_table(
        "hidden_recipes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("recipe_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["recipe_id"], ["public.recipes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["public.users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "recipe_id", name="uq_hidden_recipes_user_recipe"),
        schema="public",
    )
    op.create_index("ix_hidden_recipes_id", "hidden_recipes", ["id"], unique=False, schema="public")
    op.create_index("ix_hidden_recipes_user_id", "hidden_recipes", ["user_id"], unique=False, schema="public")
    op.create_index("ix_hidden_recipes_recipe_id", "hidden_recipes", ["recipe_id"], unique=False, schema="public")


def downgrade() -> None:
    op.drop_index("ix_hidden_recipes_recipe_id", table_name="hidden_recipes", schema="public")
    op.drop_index("ix_hidden_recipes_user_id", table_name="hidden_recipes", schema="public")
    op.drop_index("ix_hidden_recipes_id", table_name="hidden_recipes", schema="public")
    op.drop_table("hidden_recipes", schema="public")

    op.drop_constraint(
        "fk_recipes_source_recipe_id_recipes",
        "recipes",
        schema="public",
        type_="foreignkey",
    )
    op.drop_index("ix_recipes_source_recipe_id", table_name="recipes", schema="public")
    op.drop_column("recipes", "source_recipe_id", schema="public")
