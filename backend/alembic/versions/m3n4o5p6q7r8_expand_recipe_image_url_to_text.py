"""expand recipe image_url to text

Revision ID: m3n4o5p6q7r8
Revises: k2l3m4n5o6p7
Create Date: 2026-05-05 00:20:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "m3n4o5p6q7r8"
down_revision: Union[str, Sequence[str], None] = "k2l3m4n5o6p7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("recipes") as batch_op:
        batch_op.alter_column(
            "image_url",
            existing_type=sa.String(length=500),
            type_=sa.Text(),
            existing_nullable=True,
        )


def downgrade() -> None:
    with op.batch_alter_table("recipes") as batch_op:
        batch_op.alter_column(
            "image_url",
            existing_type=sa.Text(),
            type_=sa.String(length=500),
            existing_nullable=True,
        )
