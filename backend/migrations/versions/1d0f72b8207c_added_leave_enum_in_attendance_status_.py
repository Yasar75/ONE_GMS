"""restore Leave in attendance_status enum

Revision ID: 1d0f72b8207c
Revises: 888e76e4ff2a
Create Date: 2026-03-15 16:45:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from migrations.helpers import is_postgres, _create_pg_enum_if_not_exists


# revision identifiers, used by Alembic.
revision: str = "1d0f72b8207c"
down_revision: Union[str, Sequence[str], None] = "888e76e4ff2a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


ATTENDANCE_STATUS_ENUM = "attendance_status"


def upgrade() -> None:
    if not is_postgres():
        return

    conn = op.get_bind()
    enum_exists = conn.execute(
        sa.text(
            """
            SELECT 1
            FROM pg_type
            WHERE typname = :enum_name
            """
        ),
        {"enum_name": ATTENDANCE_STATUS_ENUM},
    ).scalar()

    if not enum_exists:
        _create_pg_enum_if_not_exists(
            ATTENDANCE_STATUS_ENUM,
            ["Present", "Absent", "PendingRegularization", "Leave"],
        )
        return

    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_enum e
                    JOIN pg_type t ON t.oid = e.enumtypid
                    WHERE t.typname = 'attendance_status'
                      AND e.enumlabel = 'Leave'
                ) THEN
                    ALTER TYPE attendance_status ADD VALUE 'Leave';
                END IF;
            END$$;
            """
        )
    )


def downgrade() -> None:
    # PostgreSQL does not support dropping a single enum value directly.
    # Keeping this as a no-op is safer than rebuilding the type and risking data loss.
    pass
