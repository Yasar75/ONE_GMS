"""create payslip table

Revision ID: eace0d0aa277
Revises: ff8d551b97a1
Create Date: 2026-05-07 21:05:34.165924

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlalchemy.dialects.postgresql as pg

from migrations.helpers import index_exists, table_exists

revision: str = "eace0d0aa277"
down_revision: Union[str, Sequence[str], None] = "ff8d551b97a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE_NAME = "payslips"


def upgrade() -> None:
    if not table_exists(TABLE_NAME):
        op.create_table(
            TABLE_NAME,
            sa.Column("uid", pg.UUID(as_uuid=True), nullable=False),
            sa.Column("created_by", pg.UUID(as_uuid=True), nullable=False),
            sa.Column("employee_uid", pg.UUID(as_uuid=True), nullable=False),
            sa.Column("salary_month", sa.Integer(), nullable=False),
            sa.Column("salary_year", sa.Integer(), nullable=False),
            sa.Column("original_filename", sa.VARCHAR(length=255), nullable=True),
            sa.Column("file_url", sa.Text(), nullable=False),
            sa.Column("cloudinary_public_id", sa.Text(), nullable=True),
            sa.Column("file_format", sa.VARCHAR(length=50), nullable=True),
            sa.Column("file_size", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint("uid"),
            sa.ForeignKeyConstraint(["created_by"], ["users.uid"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["employee_uid"], ["employees.uid"], ondelete="CASCADE"),
            sa.UniqueConstraint("employee_uid", "salary_month", "salary_year", name="uq_payslips_employee_month_year"),
            sa.CheckConstraint("salary_month >= 1 AND salary_month <= 12", name="ck_payslips_salary_month"),
        )

    if not index_exists(TABLE_NAME, "ix_payslips_created_by"):
        op.create_index("ix_payslips_created_by", TABLE_NAME, ["created_by"], unique=False)
    if not index_exists(TABLE_NAME, "ix_payslips_employee_uid"):
        op.create_index("ix_payslips_employee_uid", TABLE_NAME, ["employee_uid"], unique=False)
    if not index_exists(TABLE_NAME, "ix_payslips_salary_month"):
        op.create_index("ix_payslips_salary_month", TABLE_NAME, ["salary_month"], unique=False)
    if not index_exists(TABLE_NAME, "ix_payslips_salary_year"):
        op.create_index("ix_payslips_salary_year", TABLE_NAME, ["salary_year"], unique=False)


def downgrade() -> None:
    if table_exists(TABLE_NAME):
        op.drop_table(TABLE_NAME)
