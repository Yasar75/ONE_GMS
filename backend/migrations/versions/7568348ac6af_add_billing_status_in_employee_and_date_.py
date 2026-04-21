"""add billing_status in employee and date name to task_date in projectTask

Revision ID: 7568348ac6af
Revises: dc184135dcdd
Create Date: 2026-04-07 12:09:55.607522
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from migrations.helpers import (
    add_column_if_not_exists,
    column_exists,
    table_exists,
    drop_column_if_exists,
)

# revision identifiers, used by Alembic.
revision: str = "7568348ac6af"
down_revision: Union[str, Sequence[str], None] = "dc184135dcdd"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    # 1) Add billing_status in employees if not exists
    add_column_if_not_exists(
        "employees",
        sa.Column(
            "billing_status",
            sa.String(length=50),
            nullable=False,
            server_default="NonBillable",
        ),
    )

    # Optional: remove server default after existing rows are backfilled
    if table_exists("employees") and column_exists("employees", "billing_status"):
        op.alter_column(
            "employees",
            "billing_status",
            existing_type=sa.String(length=50),
            server_default=None,
            existing_nullable=False,
        )

    # 2) Rename project_tasks.date -> task_date only if needed
    if table_exists("project_tasks"):
        has_old = column_exists("project_tasks", "date")
        has_new = column_exists("project_tasks", "task_date")

        if has_old and not has_new:
            op.alter_column(
                "project_tasks",
                "date",
                new_column_name="task_date",
                existing_type=sa.Date(),
                existing_nullable=True,
            )


def downgrade() -> None:
    """Downgrade schema."""

    # 1) Rename project_tasks.task_date -> date only if needed
    if table_exists("project_tasks"):
        has_new = column_exists("project_tasks", "task_date")
        has_old = column_exists("project_tasks", "date")

        if has_new and not has_old:
            op.alter_column(
                "project_tasks",
                "task_date",
                new_column_name="date",
                existing_type=sa.Date(),
                existing_nullable=True,
            )

    # 2) Drop billing_status from employees if exists
    drop_column_if_exists("employees", "billing_status")