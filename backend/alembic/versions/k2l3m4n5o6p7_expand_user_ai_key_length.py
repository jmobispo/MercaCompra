"""expand user ai key length

Revision ID: k2l3m4n5o6p7
Revises: j7k8l9m0n1p2
Create Date: 2026-05-05 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "k2l3m4n5o6p7"
down_revision: Union[str, Sequence[str], None] = "j7k8l9m0n1p2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column(
            "ai_api_key",
            existing_type=sa.String(length=255),
            type_=sa.String(length=2048),
            existing_nullable=True,
        )


def downgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column(
            "ai_api_key",
            existing_type=sa.String(length=2048),
            type_=sa.String(length=255),
            existing_nullable=True,
        )
