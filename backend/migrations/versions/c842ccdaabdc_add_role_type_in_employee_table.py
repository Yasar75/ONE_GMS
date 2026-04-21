"""add role_type in employee table

Revision ID: c842ccdaabdc
Revises: 42f8571a31fc
Create Date: 2026-03-07 14:24:37.061510
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from migrations.helpers import (
    add_column_if_not_exists,
    column_exists,
    constraint_exists,
    drop_column_if_exists,
    drop_constraint_if_exists,
    get_fk_constraints_for_column,
    index_exists,
    table_exists,
)

revision: str = "c842ccdaabdc"
down_revision: Union[str, Sequence[str], None] = "42f8571a31fc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TABLE_NAME = "employees"
REF_TABLE = "roles"
COLUMN_NAME = "role_type"
FK_NAME = "fk_employees_role_type_roles"
INDEX_NAME = "ix_employees_role_type"


def upgrade() -> None:
    """Upgrade schema."""

    if not table_exists(TABLE_NAME):
        raise RuntimeError(f"Table '{TABLE_NAME}' does not exist.")

    if not table_exists(REF_TABLE):
        raise RuntimeError(f"Table '{REF_TABLE}' does not exist.")

    # Step 1: Add as nullable first for existing data safety
    add_column_if_not_exists(
        TABLE_NAME,
        sa.Column(
            COLUMN_NAME,
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )

    # Step 2: Create FK
    if not constraint_exists(FK_NAME, TABLE_NAME):
        op.create_foreign_key(
            FK_NAME,
            TABLE_NAME,
            REF_TABLE,
            [COLUMN_NAME],
            ["uid"],
        )

    # Step 3: Create index
    if not index_exists(TABLE_NAME, INDEX_NAME):
        op.create_index(INDEX_NAME, TABLE_NAME, [COLUMN_NAME], unique=False)

    # Step 4: ONLY do this after you backfill existing rows
    # Example:
    # op.execute("""
    #     UPDATE employees
    #     SET role_type = '<some-role-uuid>'
    #     WHERE role_type IS NULL
    # """)
    #
    # op.alter_column(TABLE_NAME, COLUMN_NAME, existing_type=postgresql.UUID(as_uuid=True), nullable=False)


def downgrade() -> None:
    """Downgrade schema."""

    if not table_exists(TABLE_NAME):
        return

    if index_exists(TABLE_NAME, INDEX_NAME):
        op.drop_index(INDEX_NAME, table_name=TABLE_NAME)

    fk_names = get_fk_constraints_for_column(TABLE_NAME, COLUMN_NAME)
    for fk_name in fk_names:
        drop_constraint_if_exists(
            TABLE_NAME,
            fk_name,
            constraint_type="foreignkey",
        )

    drop_column_if_exists(TABLE_NAME, COLUMN_NAME)