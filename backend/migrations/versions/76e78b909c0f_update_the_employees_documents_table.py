"""update the employees_documents table

Revision ID: 76e78b909c0f
Revises: 5838b7b504e3
Create Date: 2026-03-10 12:46:17.328836
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from migrations.helpers import (
    add_column_if_not_exists,
    drop_column_if_exists,
    index_exists,
)

revision: str = "76e78b909c0f"
down_revision: Union[str, Sequence[str], None] = "5838b7b504e3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TABLE_NAME = "employee_documents"
DOC_TYPE_INDEX = "ix_employee_documents_document_type"


def upgrade() -> None:
    add_column_if_not_exists(
        TABLE_NAME,
        sa.Column("document_type", sa.VARCHAR(length=20), nullable=True),
    )
    add_column_if_not_exists(
        TABLE_NAME,
        sa.Column("cloudinary_public_id", sa.Text(), nullable=True),
    )
    add_column_if_not_exists(
        TABLE_NAME,
        sa.Column("file_format", sa.VARCHAR(length=50), nullable=True),
    )
    add_column_if_not_exists(
        TABLE_NAME,
        sa.Column("file_size", sa.Integer(), nullable=True),
    )

    if not index_exists(TABLE_NAME, DOC_TYPE_INDEX):
        op.create_index(DOC_TYPE_INDEX, TABLE_NAME, ["document_type"], unique=False)

    op.execute(
        sa.text(
            f"""
            UPDATE {TABLE_NAME}
            SET document_type = 'Other'
            WHERE document_type IS NULL
            """
        )
    )

    op.alter_column(
        TABLE_NAME,
        "document_type",
        existing_type=sa.VARCHAR(length=20),
        nullable=False,
    )


def downgrade() -> None:
    if index_exists(TABLE_NAME, DOC_TYPE_INDEX):
        op.drop_index(DOC_TYPE_INDEX, table_name=TABLE_NAME)

    drop_column_if_exists(TABLE_NAME, "file_size")
    drop_column_if_exists(TABLE_NAME, "file_format")
    drop_column_if_exists(TABLE_NAME, "cloudinary_public_id")
    drop_column_if_exists(TABLE_NAME, "document_type")