"""create employee_family details table

Revision ID: 6c4cf980ab59
Revises: cbd5fc6bff33
Create Date: 2026-03-23 12:52:02.052597

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from migrations.helpers import (
    table_exists,
    index_exists,
)

# revision identifiers, used by Alembic.
revision: str = "6c4cf980ab59"
down_revision: Union[str, Sequence[str], None] = "cbd5fc6bff33"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TABLE_NAME = "employee_family_details"

IX_USER_UID = op.f("ix_employee_family_details_user_uid")
IX_EMPLOYEE_UID = op.f("ix_employee_family_details_employee_uid")
IX_RELATION = op.f("ix_employee_family_details_relation")


def upgrade() -> None:
    if not table_exists(TABLE_NAME):
        op.create_table(
            TABLE_NAME,
            sa.Column("uid", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("user_uid", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("employee_uid", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("relation", sa.String(length=100), nullable=False),
            sa.Column("full_name", sa.String(length=150), nullable=False),
            sa.Column("date_of_birth", sa.Date(), nullable=True),
            sa.Column("phone", sa.String(length=20), nullable=True),
            sa.Column("occupation", sa.String(length=120), nullable=True),
            sa.Column(
                "is_dependent",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            ),
            sa.Column("address", sa.Text(), nullable=True),
            sa.Column("remarks", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["user_uid"], ["users.uid"], name="fk_employee_family_user_uid"),
            sa.ForeignKeyConstraint(
                ["employee_uid"],
                ["employees.uid"],
                name="fk_employee_family_employee_uid",
                ondelete="CASCADE",
            ),
            sa.PrimaryKeyConstraint("uid", name="pk_employee_family_details"),
            sa.UniqueConstraint(
                "employee_uid",
                "relation",
                "full_name",
                name="uq_employee_family_employee_relation_name",
            ),
        )

    if table_exists(TABLE_NAME) and not index_exists(TABLE_NAME, IX_USER_UID):
        op.create_index(
            IX_USER_UID,
            TABLE_NAME,
            ["user_uid"],
            unique=False,
        )

    if table_exists(TABLE_NAME) and not index_exists(TABLE_NAME, IX_EMPLOYEE_UID):
        op.create_index(
            IX_EMPLOYEE_UID,
            TABLE_NAME,
            ["employee_uid"],
            unique=False,
        )

    if table_exists(TABLE_NAME) and not index_exists(TABLE_NAME, IX_RELATION):
        op.create_index(
            IX_RELATION,
            TABLE_NAME,
            ["relation"],
            unique=False,
        )


def downgrade() -> None:
    if table_exists(TABLE_NAME) and index_exists(TABLE_NAME, IX_RELATION):
        op.drop_index(IX_RELATION, table_name=TABLE_NAME)

    if table_exists(TABLE_NAME) and index_exists(TABLE_NAME, IX_EMPLOYEE_UID):
        op.drop_index(IX_EMPLOYEE_UID, table_name=TABLE_NAME)

    if table_exists(TABLE_NAME) and index_exists(TABLE_NAME, IX_USER_UID):
        op.drop_index(IX_USER_UID, table_name=TABLE_NAME)

    if table_exists(TABLE_NAME):
        op.drop_table(TABLE_NAME)