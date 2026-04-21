"""Added gender and caste in employee table

Revision ID: 888e76e4ff2a
Revises: 76e78b909c0f
Create Date: 2026-03-14 10:29:13.642384
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from migrations.helpers import add_column_if_not_exists, drop_column_if_exists


# revision identifiers, used by Alembic.
revision: str = "888e76e4ff2a"
down_revision: Union[str, Sequence[str], None] = "76e78b909c0f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    add_column_if_not_exists(
        "employees",
        sa.Column("gender", sa.Text(), nullable=True),
    )

    add_column_if_not_exists(
        "employees",
        sa.Column("caste", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""

    drop_column_if_exists("employees", "caste")
    drop_column_if_exists("employees", "gender")