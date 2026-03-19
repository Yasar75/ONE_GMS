"""Added new lock_fields in users table

Revision ID: fd2acb046f48
Revises: 1d0f72b8207c
Create Date: 2026-03-18 15:44:16.344693
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from migrations.helpers import (
    add_column_if_not_exists,
    drop_column_if_exists,
)

# revision identifiers, used by Alembic.
revision: str = "fd2acb046f48"
down_revision: Union[str, Sequence[str], None] = "1d0f72b8207c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    add_column_if_not_exists(
        "users",
        sa.Column(
            "is_locked",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    add_column_if_not_exists(
        "users",
        sa.Column(
            "locked_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    add_column_if_not_exists(
        "users",
        sa.Column(
            "locked_reason",
            sa.Text(),
            nullable=True,
        ),
    )

    add_column_if_not_exists(
        "users",
        sa.Column(
            "first_login_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    add_column_if_not_exists(
        "users",
        sa.Column(
            "unlocked_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    # Optional: remove server default after backfilling existing rows
    # so future inserts rely on model/db explicit values if you prefer.
    # op.alter_column("users", "is_locked", server_default=None)


def downgrade() -> None:
    drop_column_if_exists("users", "unlocked_at")
    drop_column_if_exists("users", "first_login_at")
    drop_column_if_exists("users", "locked_reason")
    drop_column_if_exists("users", "locked_at")
    drop_column_if_exists("users", "is_locked")