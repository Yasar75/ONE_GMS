"""create employee_experience details table

Revision ID: 8b447a0d3679
Revises: 6c4cf980ab59
Create Date: 2026-03-30 11:31:52.101215

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from migrations.helpers import (
    table_exists,
    index_exists,
    constraint_exists,
    create_foreign_key_if_not_exists,
    create_check_constraint_if_not_exists,
    drop_constraint_if_exists,
)

# revision identifiers, used by Alembic.
revision: str = "8b447a0d3679"
down_revision: Union[str, Sequence[str], None] = "6c4cf980ab59"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TABLE_NAME = "employee_work_experiences"


def upgrade() -> None:
    """Upgrade schema."""

    if not table_exists(TABLE_NAME):
        op.create_table(
            TABLE_NAME,
            sa.Column("uid", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("user_uid", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("employee_uid", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("company_name", postgresql.VARCHAR(length=150), nullable=False),
            sa.Column("job_title", postgresql.VARCHAR(length=120), nullable=False),
            sa.Column("employment_type", postgresql.VARCHAR(length=50), nullable=True),
            sa.Column("location", postgresql.VARCHAR(length=120), nullable=True),
            sa.Column("start_date", sa.Date(), nullable=False),
            sa.Column("end_date", sa.Date(), nullable=True),
            sa.Column("is_current", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("year_of_exp", sa.Numeric(5, 2), nullable=True),
            sa.Column("responsibilities", sa.Text(), nullable=True),
            sa.Column("last_salary", sa.Numeric(12, 2), nullable=True),
            sa.Column("reason_for_leaving", sa.Text(), nullable=True),
            sa.Column("remarks", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        )

    # Indexes
    if not index_exists(TABLE_NAME, "ix_employee_work_experiences_user_uid"):
        op.create_index(
            "ix_employee_work_experiences_user_uid",
            TABLE_NAME,
            ["user_uid"],
            unique=False,
        )

    if not index_exists(TABLE_NAME, "ix_employee_work_experiences_employee_uid"):
        op.create_index(
            "ix_employee_work_experiences_employee_uid",
            TABLE_NAME,
            ["employee_uid"],
            unique=False,
        )

    if not index_exists(TABLE_NAME, "ix_employee_work_experiences_company_name"):
        op.create_index(
            "ix_employee_work_experiences_company_name",
            TABLE_NAME,
            ["company_name"],
            unique=False,
        )

    # Foreign keys
    create_foreign_key_if_not_exists(
        constraint_name="fk_employee_work_experiences_user_uid_users",
        source_table=TABLE_NAME,
        referent_table="users",
        local_cols=["user_uid"],
        remote_cols=["uid"],
    )

    create_foreign_key_if_not_exists(
        constraint_name="fk_employee_work_experiences_employee_uid_employees",
        source_table=TABLE_NAME,
        referent_table="employees",
        local_cols=["employee_uid"],
        remote_cols=["uid"],
        ondelete="CASCADE",
    )

    # Check constraints
    create_check_constraint_if_not_exists(
        table_name=TABLE_NAME,
        constraint_name="ck_employee_work_experiences_year_of_exp_non_negative",
        condition_sql="year_of_exp IS NULL OR year_of_exp >= 0",
    )

    create_check_constraint_if_not_exists(
        table_name=TABLE_NAME,
        constraint_name="ck_employee_work_experiences_last_salary_non_negative",
        condition_sql="last_salary IS NULL OR last_salary >= 0",
    )

    create_check_constraint_if_not_exists(
        table_name=TABLE_NAME,
        constraint_name="ck_employee_work_experiences_end_date_valid",
        condition_sql="end_date IS NULL OR end_date >= start_date",
    )


def downgrade() -> None:
    """Downgrade schema."""

    drop_constraint_if_exists(
        table_name=TABLE_NAME,
        constraint_name="ck_employee_work_experiences_end_date_valid",
        constraint_type="check",
    )

    drop_constraint_if_exists(
        table_name=TABLE_NAME,
        constraint_name="ck_employee_work_experiences_last_salary_non_negative",
        constraint_type="check",
    )

    drop_constraint_if_exists(
        table_name=TABLE_NAME,
        constraint_name="ck_employee_work_experiences_year_of_exp_non_negative",
        constraint_type="check",
    )

    drop_constraint_if_exists(
        table_name=TABLE_NAME,
        constraint_name="fk_employee_work_experiences_employee_uid_employees",
        constraint_type="foreignkey",
    )

    drop_constraint_if_exists(
        table_name=TABLE_NAME,
        constraint_name="fk_employee_work_experiences_user_uid_users",
        constraint_type="foreignkey",
    )

    if table_exists(TABLE_NAME):
        if index_exists(TABLE_NAME, "ix_employee_work_experiences_company_name"):
            op.drop_index("ix_employee_work_experiences_company_name", table_name=TABLE_NAME)

        if index_exists(TABLE_NAME, "ix_employee_work_experiences_employee_uid"):
            op.drop_index("ix_employee_work_experiences_employee_uid", table_name=TABLE_NAME)

        if index_exists(TABLE_NAME, "ix_employee_work_experiences_user_uid"):
            op.drop_index("ix_employee_work_experiences_user_uid", table_name=TABLE_NAME)

        op.drop_table(TABLE_NAME)