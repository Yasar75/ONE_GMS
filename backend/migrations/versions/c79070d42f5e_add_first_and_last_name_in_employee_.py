"""add first_name and last_name to employees; drop name

Revision ID: c79070d42f5e
Revises: 568ba3d076d6
Create Date: 2026-02-24 22:31:20.099544
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from migrations.helpers import (
    table_exists,
    column_exists,
    add_column_if_not_exists,
    drop_column_if_exists,
    is_postgres,
)

# revision identifiers, used by Alembic.
revision: str = "c79070d42f5e"
down_revision: Union[str, Sequence[str], None] = "568ba3d076d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


EMP_TABLE = "employees"


def upgrade() -> None:
    # Safety: only run if table exists
    if not table_exists(EMP_TABLE):
        return

    # 1) Add columns safely.
    # IMPORTANT:
    # - Adding a NOT NULL column on a non-empty table will fail unless we provide a default or do it in steps.
    # - So: add first_name as nullable with server_default '', backfill, then set NOT NULL, then remove default.
    if not column_exists(EMP_TABLE, "first_name"):
        op.add_column(
            EMP_TABLE,
            sa.Column("first_name", sa.VARCHAR(length=120), nullable=True, server_default=""),
        )

    add_column_if_not_exists(
        EMP_TABLE,
        sa.Column("last_name", sa.VARCHAR(length=120), nullable=True),
    )

    # 2) Backfill from `name` if it exists (Postgres).
    # If `name` doesn't exist, ensure first_name isn't NULL for existing rows.
    if is_postgres():
        if column_exists(EMP_TABLE, "name"):
            # Split `name` into first token and the rest.
            # - first_name: split_part(name,' ',1)
            # - last_name: remaining string after first space (trimmed), NULL if empty
            op.execute(
                sa.text(
                    f"""
                    UPDATE {EMP_TABLE}
                    SET
                        first_name = COALESCE(NULLIF(BTRIM(split_part(name, ' ', 1)), ''), first_name, ''),
                        last_name  = NULLIF(
                            BTRIM(
                                CASE
                                    WHEN position(' ' in name) > 0 THEN substr(name, position(' ' in name) + 1)
                                    ELSE ''
                                END
                            ),
                            ''
                        )
                    WHERE (first_name IS NULL OR first_name = '')
                    """
                )
            )
        else:
            # No `name` column: guarantee first_name has no NULLs
            op.execute(
                sa.text(
                    f"""
                    UPDATE {EMP_TABLE}
                    SET first_name = ''
                    WHERE first_name IS NULL
                    """
                )
            )
    else:
        # Non-postgres fallback: just avoid NULL first_name
        op.execute(
            sa.text(
                f"""
                UPDATE {EMP_TABLE}
                SET first_name = ''
                WHERE first_name IS NULL
                """
            )
        )

    # 3) Enforce NOT NULL on first_name (safe now), then drop default.
    op.alter_column(EMP_TABLE, "first_name", existing_type=sa.VARCHAR(length=120), nullable=False)
    op.alter_column(EMP_TABLE, "first_name", server_default=None)

    # 4) Drop `name` column if it exists.
    drop_column_if_exists(EMP_TABLE, "name")


def downgrade() -> None:
    if not table_exists(EMP_TABLE):
        return

    # Re-create `name` column (NOT NULL) safely in steps.
    if not column_exists(EMP_TABLE, "name"):
        op.add_column(
            EMP_TABLE,
            sa.Column("name", sa.VARCHAR(length=120), nullable=True, server_default=""),
        )

    # Backfill name from first_name + last_name
    if is_postgres():
        op.execute(
            sa.text(
                f"""
                UPDATE {EMP_TABLE}
                SET name = COALESCE(NULLIF(BTRIM(concat_ws(' ', first_name, last_name)), ''), '')
                WHERE name IS NULL OR name = ''
                """
            )
        )
    else:
        op.execute(
            sa.text(
                f"""
                UPDATE {EMP_TABLE}
                SET name = COALESCE(name, '')
                WHERE name IS NULL
                """
            )
        )

    # Enforce NOT NULL and remove default
    op.alter_column(EMP_TABLE, "name", existing_type=sa.VARCHAR(length=120), nullable=False)
    op.alter_column(EMP_TABLE, "name", server_default=None)

    # Drop new columns
    drop_column_if_exists(EMP_TABLE, "last_name")
    drop_column_if_exists(EMP_TABLE, "first_name")