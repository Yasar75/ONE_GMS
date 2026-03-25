"""Convert leave_types.code from enum to string

Revision ID: d7865f602976
Revises: fd2acb046f48
Create Date: 2026-03-20 15:16:29.656190
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from migrations.helpers import is_postgres

# revision identifiers, used by Alembic.
revision: str = "d7865f602976"
down_revision: Union[str, Sequence[str], None] = "fd2acb046f48"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


OLD_ENUM_NAME = "leave_type_code"
OLD_ENUM_VALUES = ("EL", "CL", "SL", "ML", "PL")


def upgrade() -> None:
    conn = op.get_bind()

    if is_postgres():
        # Convert enum column to plain string
        op.alter_column(
            "leave_types",
            "code",
            existing_type=sa.Enum(*OLD_ENUM_VALUES, name=OLD_ENUM_NAME),
            type_=sa.String(length=100),
            existing_nullable=False,
            postgresql_using="code::text",
        )

        # Drop old enum type if no longer needed
        op.execute(sa.text(f'DROP TYPE IF EXISTS "{OLD_ENUM_NAME}"'))
    else:
        # Fallback for non-Postgres databases
        op.alter_column(
            "leave_types",
            "code",
            existing_type=sa.Enum(*OLD_ENUM_VALUES, name=OLD_ENUM_NAME),
            type_=sa.String(length=100),
            existing_nullable=False,
        )


def downgrade() -> None:
    if is_postgres():
        # Recreate enum type if not exists
        values_sql = ", ".join(f"'{v}'" for v in OLD_ENUM_VALUES)
        op.execute(
            sa.text(
                f"""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_type
                        WHERE typname = '{OLD_ENUM_NAME}'
                    ) THEN
                        CREATE TYPE "{OLD_ENUM_NAME}" AS ENUM ({values_sql});
                    END IF;
                END$$;
                """
            )
        )

        # Convert string back to enum
        op.alter_column(
            "leave_types",
            "code",
            existing_type=sa.String(length=100),
            type_=sa.Enum(*OLD_ENUM_VALUES, name=OLD_ENUM_NAME),
            existing_nullable=False,
            postgresql_using=f'code::"{OLD_ENUM_NAME}"',
        )
    else:
        # Fallback for non-Postgres databases
        op.alter_column(
            "leave_types",
            "code",
            existing_type=sa.String(length=100),
            type_=sa.Enum(*OLD_ENUM_VALUES, name=OLD_ENUM_NAME),
            existing_nullable=False,
        )