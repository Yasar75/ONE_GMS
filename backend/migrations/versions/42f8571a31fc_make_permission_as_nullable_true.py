"""make permission as nullable true

Revision ID: 42f8571a31fc
Revises: 40f53acf2b13
Create Date: 2026-03-06 20:59:37.457817
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from migrations.helpers import table_exists, column_exists

# revision identifiers, used by Alembic.
revision: str = "42f8571a31fc"
down_revision: Union[str, Sequence[str], None] = "40f53acf2b13"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TABLE_NAME = "roles"
COLUMN_NAME = "permissions"


def upgrade() -> None:
    """Upgrade schema."""
    if table_exists(TABLE_NAME) and column_exists(TABLE_NAME, COLUMN_NAME):
        op.alter_column(
            TABLE_NAME,
            COLUMN_NAME,
            existing_type=postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        )


def downgrade() -> None:
    """Downgrade schema."""
    if table_exists(TABLE_NAME) and column_exists(TABLE_NAME, COLUMN_NAME):
        op.alter_column(
            TABLE_NAME,
            COLUMN_NAME,
            existing_type=postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        )