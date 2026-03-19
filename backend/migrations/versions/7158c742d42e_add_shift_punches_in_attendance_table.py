"""add shift punches in attendance table

Revision ID: 7158c742d42e
Revises: c79070d42f5e
Create Date: 2026-03-05 16:46:13.105269

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# ✅ use helper functions
from migrations.helpers import add_column_if_not_exists, drop_column_if_exists

# revision identifiers, used by Alembic.
revision: str = "7158c742d42e"
down_revision: Union[str, Sequence[str], None] = "c79070d42f5e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    add_column_if_not_exists(
        "attendance",
        sa.Column(
            "shift_punches",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    drop_column_if_exists("attendance", "shift_punches")