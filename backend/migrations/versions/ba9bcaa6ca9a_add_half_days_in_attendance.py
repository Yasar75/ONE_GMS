"""add half days in attendance

Revision ID: ba9bcaa6ca9a
Revises: 7568348ac6af
Create Date: 2026-04-14 15:08:59.876202
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from migrations.helpers import is_postgres, table_exists, constraint_exists


# revision identifiers, used by Alembic.
revision: str = "ba9bcaa6ca9a"
down_revision: Union[str, Sequence[str], None] = "7568348ac6af"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    if not table_exists("attendance"):
        return

    if is_postgres():
        # Add HalfDay to existing attendance_status enum
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
                          AND e.enumlabel = 'HalfDay'
                    ) THEN
                        ALTER TYPE attendance_status ADD VALUE 'HalfDay';
                    END IF;
                END$$;
                """
            )
        )

        # Add WO to existing attendance_status enum
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
                          AND e.enumlabel = 'WO'
                    ) THEN
                        ALTER TYPE attendance_status ADD VALUE 'WO';
                    END IF;
                END$$;
                """
            )
        )

    # Clean duplicate employee/date attendance rows before adding unique constraint
    op.execute(
        sa.text(
            """
            DELETE FROM attendance a
            USING (
                SELECT uid
                FROM (
                    SELECT
                        uid,
                        ROW_NUMBER() OVER (
                            PARTITION BY employee_uid, attendance_date
                            ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, uid DESC
                        ) AS rn
                    FROM attendance
                ) t
                WHERE t.rn > 1
            ) d
            WHERE a.uid = d.uid
            """
        )
    )

    if not constraint_exists("uq_attendance_employee_date", "attendance"):
        op.create_unique_constraint(
            "uq_attendance_employee_date",
            "attendance",
            ["employee_uid", "attendance_date"],
        )


def downgrade() -> None:
    """Downgrade schema."""

    if table_exists("attendance") and constraint_exists("uq_attendance_employee_date", "attendance"):
        op.drop_constraint(
            "uq_attendance_employee_date",
            "attendance",
            type_="unique",
        )

    # Postgres does not safely support removing enum values directly.
    # So HalfDay / WO are intentionally left in attendance_status.
    pass