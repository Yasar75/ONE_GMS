"""add blood group in employee table

Revision ID: 200c2db2a173
Revises: ba9bcaa6ca9a
Create Date: 2026-04-15 12:40:46.744211
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel

from migrations.helpers import add_column_if_not_exists, drop_column_if_exists


# revision identifiers, used by Alembic.
revision: str = "200c2db2a173"
down_revision: Union[str, Sequence[str], None] = "ba9bcaa6ca9a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    add_column_if_not_exists(
        "employees",
        sa.Column("blood_group", sa.String(length=20), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    drop_column_if_exists("employees", "blood_group")