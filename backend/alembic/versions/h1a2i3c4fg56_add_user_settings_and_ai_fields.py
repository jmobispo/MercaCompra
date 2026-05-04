"""add user settings and ai fields

Revision ID: h1a2i3c4fg56
Revises: 2b4c6d8e9f10
Create Date: 2026-05-04 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "h1a2i3c4fg56"
down_revision = "2b4c6d8e9f10"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("theme_mode", sa.String(length=20), nullable=False, server_default="light"))
    op.add_column("users", sa.Column("accent_color", sa.String(length=30), nullable=False, server_default="green"))
    op.add_column("users", sa.Column("ai_enabled", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("users", sa.Column("ai_provider", sa.String(length=30), nullable=False, server_default="openai"))
    op.add_column("users", sa.Column("ai_model", sa.String(length=100), nullable=False, server_default="gpt-4.1-mini"))
    op.add_column("users", sa.Column("ai_api_key", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("ai_recipe_autofill", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column("users", sa.Column("ai_list_assist", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column("users", sa.Column("ai_plan_assist", sa.Boolean(), nullable=False, server_default=sa.true()))

    op.alter_column("users", "theme_mode", server_default=None)
    op.alter_column("users", "accent_color", server_default=None)
    op.alter_column("users", "ai_enabled", server_default=None)
    op.alter_column("users", "ai_provider", server_default=None)
    op.alter_column("users", "ai_model", server_default=None)
    op.alter_column("users", "ai_recipe_autofill", server_default=None)
    op.alter_column("users", "ai_list_assist", server_default=None)
    op.alter_column("users", "ai_plan_assist", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "ai_plan_assist")
    op.drop_column("users", "ai_list_assist")
    op.drop_column("users", "ai_recipe_autofill")
    op.drop_column("users", "ai_api_key")
    op.drop_column("users", "ai_model")
    op.drop_column("users", "ai_provider")
    op.drop_column("users", "ai_enabled")
    op.drop_column("users", "accent_color")
    op.drop_column("users", "theme_mode")
