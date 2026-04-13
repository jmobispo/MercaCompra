"""add_ui_mode_to_users

Revision ID: d9a1e2b3c4f5
Revises: c7e2f1a3b084
Create Date: 2026-04-13 11:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d9a1e2b3c4f5"
down_revision: Union[str, None] = "c7e2f1a3b084"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("ui_mode", sa.String(length=20), nullable=False, server_default="advanced"),
    )


def downgrade() -> None:
    op.drop_column("users", "ui_mode")
