"""keep field employees type as text field

Revision ID: ff8d551b97a1
Revises: 200c2db2a173
Create Date: 2026-04-16 15:49:43.208147
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlalchemy.dialects.postgresql as pg

from migrations.helpers import (
    table_exists,
    column_exists,
    constraint_exists,
    create_foreign_key_if_not_exists,
    index_exists,
    is_postgres,
)

# revision identifiers, used by Alembic.
revision: str = "ff8d551b97a1"
down_revision: Union[str, Sequence[str], None] = "200c2db2a173"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


EMPLOYEES_TABLE = "employees"
EMPLOYEE_TYPE_COLUMN = "employee_type"
EMPLOYEE_TYPE_ENUM_NAME = "employee_type"

EMPLOYEE_METADATA_TABLE = "employee_metadata"
EMPLOYEE_METADATA_UQ = "uq_employee_metadata_category_value"
EMPLOYEE_METADATA_FK_CREATED_BY = "fk_employee_metadata_created_by_users"
EMPLOYEE_METADATA_CATEGORY_INDEX = "ix_employee_metadata_category"


def upgrade() -> None:
    """Upgrade schema."""

    # ---------------------------------------------------------
    # 1) employees.employee_type : ENUM -> VARCHAR(100)
    # ---------------------------------------------------------
    if table_exists(EMPLOYEES_TABLE) and column_exists(EMPLOYEES_TABLE, EMPLOYEE_TYPE_COLUMN):
        if is_postgres():
            op.execute(
                sa.text(
                    f"""
                    ALTER TABLE {EMPLOYEES_TABLE}
                    ALTER COLUMN {EMPLOYEE_TYPE_COLUMN}
                    TYPE VARCHAR(100)
                    USING {EMPLOYEE_TYPE_COLUMN}::text
                    """
                )
            )

            op.execute(
                sa.text(f'DROP TYPE IF EXISTS "{EMPLOYEE_TYPE_ENUM_NAME}"')
            )
        else:
            op.alter_column(
                EMPLOYEES_TABLE,
                EMPLOYEE_TYPE_COLUMN,
                existing_nullable=True,
                type_=sa.String(length=100),
            )

    # ---------------------------------------------------------
    # 2) create employee_metadata table
    # ---------------------------------------------------------
    if not table_exists(EMPLOYEE_METADATA_TABLE):
        op.create_table(
            EMPLOYEE_METADATA_TABLE,
            sa.Column(
                "uid",
                pg.UUID(as_uuid=True),
                primary_key=True,
                nullable=False,
                server_default=sa.text("gen_random_uuid()") if is_postgres() else None,
            ),
            sa.Column("category", pg.VARCHAR(length=40), nullable=False),
            sa.Column("value", pg.VARCHAR(length=120), nullable=False),
            sa.Column("label", pg.VARCHAR(length=120), nullable=False),
            sa.Column("description", pg.VARCHAR(length=255), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("created_by", pg.UUID(as_uuid=True), nullable=True),
            sa.Column(
                "created_at",
                pg.TIMESTAMP(timezone=True),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.Column(
                "updated_at",
                pg.TIMESTAMP(timezone=True),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.PrimaryKeyConstraint("uid"),
        )

    # unique constraint
    if table_exists(EMPLOYEE_METADATA_TABLE) and not constraint_exists(
        EMPLOYEE_METADATA_UQ,
        EMPLOYEE_METADATA_TABLE,
    ):
        op.create_unique_constraint(
            EMPLOYEE_METADATA_UQ,
            EMPLOYEE_METADATA_TABLE,
            ["category", "value"],
        )

    # index
    if table_exists(EMPLOYEE_METADATA_TABLE) and not index_exists(
        EMPLOYEE_METADATA_TABLE,
        EMPLOYEE_METADATA_CATEGORY_INDEX,
    ):
        op.create_index(
            EMPLOYEE_METADATA_CATEGORY_INDEX,
            EMPLOYEE_METADATA_TABLE,
            ["category"],
            unique=False,
        )

    # foreign key
    if table_exists(EMPLOYEE_METADATA_TABLE):
        create_foreign_key_if_not_exists(
            constraint_name=EMPLOYEE_METADATA_FK_CREATED_BY,
            source_table=EMPLOYEE_METADATA_TABLE,
            referent_table="users",
            local_cols=["created_by"],
            remote_cols=["uid"],
            ondelete=None,
        )


def downgrade() -> None:
    """Downgrade schema."""

    # ---------------------------------------------------------
    # 1) drop employee_metadata table
    # ---------------------------------------------------------
    if table_exists(EMPLOYEE_METADATA_TABLE):
        if index_exists(EMPLOYEE_METADATA_TABLE, EMPLOYEE_METADATA_CATEGORY_INDEX):
            op.drop_index(EMPLOYEE_METADATA_CATEGORY_INDEX, table_name=EMPLOYEE_METADATA_TABLE)

        op.drop_table(EMPLOYEE_METADATA_TABLE)

    # ---------------------------------------------------------
    # 2) employees.employee_type : VARCHAR(100) -> ENUM
    # ---------------------------------------------------------
    if table_exists(EMPLOYEES_TABLE) and column_exists(EMPLOYEES_TABLE, EMPLOYEE_TYPE_COLUMN):
        if is_postgres():
            op.execute(
                sa.text(
                    """
                    DO $$
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1
                            FROM pg_type
                            WHERE typname = 'employee_type'
                        ) THEN
                            CREATE TYPE employee_type AS ENUM (
                                'FullTime',
                                'PartTime',
                                'Contract',
                                'Intern'
                            );
                        END IF;
                    END$$;
                    """
                )
            )

            op.execute(
                sa.text(
                    f"""
                    ALTER TABLE {EMPLOYEES_TABLE}
                    ALTER COLUMN {EMPLOYEE_TYPE_COLUMN}
                    TYPE employee_type
                    USING (
                        CASE
                            WHEN {EMPLOYEE_TYPE_COLUMN} IN ('FullTime', 'PartTime', 'Contract', 'Intern')
                                THEN {EMPLOYEE_TYPE_COLUMN}::employee_type
                            ELSE NULL
                        END
                    )
                    """
                )
            )
        else:
            op.alter_column(
                EMPLOYEES_TABLE,
                EMPLOYEE_TYPE_COLUMN,
                existing_nullable=True,
                type_=sa.String(),
            )