"""Move employee mappings to reporting_assignments JSONB.

Revision ID: 4e5f6a7b8c9d
Revises: ff8d551b97a1
Create Date: 2026-04-17 13:20:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from migrations.helpers import (
    add_column_if_not_exists,
    column_exists,
    create_foreign_key_if_not_exists,
    drop_column_if_exists,
    index_exists,
    table_exists,
)


# revision identifiers, used by Alembic.
revision: str = "4e5f6a7b8c9d"
down_revision: Union[str, Sequence[str], None] = "ff8d551b97a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


LEGACY_ASSIGNMENT_COLUMNS = (
    "manager_employee_uid",
    "hr_employee_uid",
    "team_lead_employee_uid",
    "coordinator_employee_uid",
)


def upgrade() -> None:
    """Upgrade schema."""

    if not table_exists("employees"):
        return

    add_column_if_not_exists(
        "employees",
        sa.Column(
            "reporting_assignments",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )

    existing_legacy_columns = [column_name for column_name in LEGACY_ASSIGNMENT_COLUMNS if column_exists("employees", column_name)]
    if existing_legacy_columns:
        assignment_fragments = ", ".join(
            f"'{column_name}', {column_name}::text" for column_name in existing_legacy_columns
        )
        op.execute(
            sa.text(
                f"""
                UPDATE employees
                SET reporting_assignments = COALESCE(reporting_assignments, '{{}}'::jsonb)
                    || jsonb_strip_nulls(jsonb_build_object({assignment_fragments}))
                """
            )
        )

    for column_name in LEGACY_ASSIGNMENT_COLUMNS:
        drop_column_if_exists("employees", column_name)


def downgrade() -> None:
    """Downgrade schema."""

    if not table_exists("employees"):
        return

    for column_name in LEGACY_ASSIGNMENT_COLUMNS:
        add_column_if_not_exists(
            "employees",
            sa.Column(column_name, postgresql.UUID(as_uuid=True), nullable=True),
        )

    create_foreign_key_if_not_exists(
        "fk_employees_manager_employee_uid_employees",
        "employees",
        "employees",
        ["manager_employee_uid"],
        ["uid"],
        ondelete="SET NULL",
    )
    create_foreign_key_if_not_exists(
        "fk_employees_hr_employee_uid_employees",
        "employees",
        "employees",
        ["hr_employee_uid"],
        ["uid"],
        ondelete="SET NULL",
    )
    create_foreign_key_if_not_exists(
        "fk_employees_team_lead_employee_uid_employees",
        "employees",
        "employees",
        ["team_lead_employee_uid"],
        ["uid"],
        ondelete="SET NULL",
    )
    create_foreign_key_if_not_exists(
        "fk_employees_coordinator_employee_uid_employees",
        "employees",
        "employees",
        ["coordinator_employee_uid"],
        ["uid"],
        ondelete="SET NULL",
    )

    if not index_exists("employees", "ix_employees_manager_employee_uid"):
        op.create_index("ix_employees_manager_employee_uid", "employees", ["manager_employee_uid"], unique=False)
    if not index_exists("employees", "ix_employees_hr_employee_uid"):
        op.create_index("ix_employees_hr_employee_uid", "employees", ["hr_employee_uid"], unique=False)
    if not index_exists("employees", "ix_employees_team_lead_employee_uid"):
        op.create_index("ix_employees_team_lead_employee_uid", "employees", ["team_lead_employee_uid"], unique=False)
    if not index_exists("employees", "ix_employees_coordinator_employee_uid"):
        op.create_index("ix_employees_coordinator_employee_uid", "employees", ["coordinator_employee_uid"], unique=False)

    if column_exists("employees", "reporting_assignments"):
        op.execute(
            sa.text(
                """
                UPDATE employees
                SET manager_employee_uid = NULLIF(reporting_assignments ->> 'manager_employee_uid', '')::uuid,
                    hr_employee_uid = NULLIF(reporting_assignments ->> 'hr_employee_uid', '')::uuid,
                    team_lead_employee_uid = NULLIF(reporting_assignments ->> 'team_lead_employee_uid', '')::uuid,
                    coordinator_employee_uid = NULLIF(reporting_assignments ->> 'coordinator_employee_uid', '')::uuid
                """
            )
        )

        drop_column_if_exists("employees", "reporting_assignments")
