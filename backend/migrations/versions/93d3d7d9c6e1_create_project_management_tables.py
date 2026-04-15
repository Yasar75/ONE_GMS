"""Create_Project_Management_Tables

Revision ID: 93d3d7d9c6e1
Revises: c89474e6f86b
Create Date: 2026-04-06 15:52:22.706285

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from migrations.helpers import (
    table_exists,
    index_exists,
    create_foreign_key_if_not_exists,
)

# revision identifiers, used by Alembic.
revision: str = "93d3d7d9c6e1"
down_revision: Union[str, Sequence[str], None] = "c89474e6f86b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    if not table_exists("projects"):
        op.create_table(
            "projects",
            sa.Column("uid", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("project_code", sa.VARCHAR(length=30), nullable=False),
            sa.Column("project_name", sa.VARCHAR(length=150), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("start_date", sa.Date(), nullable=True),
            sa.Column("end_date", sa.Date(), nullable=True),
            sa.Column("status", sa.Text(), nullable=True),
            sa.Column("pod_name", sa.Text(), nullable=True),
            sa.Column("team_lead", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint("uid", name="pk_projects"),
            sa.UniqueConstraint("project_code", name="uq_projects_project_code"),
        )

    create_foreign_key_if_not_exists(
        constraint_name="fk_projects_created_by_users",
        source_table="projects",
        referent_table="users",
        local_cols=["created_by"],
        remote_cols=["uid"],
    )

    if not index_exists("projects", "ix_projects_created_by"):
        op.create_index("ix_projects_created_by", "projects", ["created_by"], unique=False)

    if not index_exists("projects", "ix_projects_project_code"):
        op.create_index("ix_projects_project_code", "projects", ["project_code"], unique=False)

    if not index_exists("projects", "ix_projects_project_name"):
        op.create_index("ix_projects_project_name", "projects", ["project_name"], unique=False)

    if not table_exists("project_assignments"):
        op.create_table(
            "project_assignments",
            sa.Column("uid", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("project_uid", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("employee_uid", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("assigned_from", sa.Date(), nullable=True),
            sa.Column("assigned_to", sa.Date(), nullable=True),
            sa.Column("allocation_percentage", sa.Integer(), nullable=True),
            sa.Column("status", sa.Text(), nullable=True),
            sa.Column("billing_status", sa.Text(), nullable=True),
            sa.Column("remarks", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint("uid", name="pk_project_assignments"),
        )

    create_foreign_key_if_not_exists(
        constraint_name="fk_project_assignments_created_by_users",
        source_table="project_assignments",
        referent_table="users",
        local_cols=["created_by"],
        remote_cols=["uid"],
    )
    create_foreign_key_if_not_exists(
        constraint_name="fk_project_assignments_project_uid_projects",
        source_table="project_assignments",
        referent_table="projects",
        local_cols=["project_uid"],
        remote_cols=["uid"],
        ondelete="CASCADE",
    )
    create_foreign_key_if_not_exists(
        constraint_name="fk_project_assignments_employee_uid_employees",
        source_table="project_assignments",
        referent_table="employees",
        local_cols=["employee_uid"],
        remote_cols=["uid"],
        ondelete="CASCADE",
    )

    if not index_exists("project_assignments", "ix_project_assignments_created_by"):
        op.create_index(
            "ix_project_assignments_created_by",
            "project_assignments",
            ["created_by"],
            unique=False,
        )

    if not index_exists("project_assignments", "ix_project_assignments_project_uid"):
        op.create_index(
            "ix_project_assignments_project_uid",
            "project_assignments",
            ["project_uid"],
            unique=False,
        )

    if not index_exists("project_assignments", "ix_project_assignments_employee_uid"):
        op.create_index(
            "ix_project_assignments_employee_uid",
            "project_assignments",
            ["employee_uid"],
            unique=False,
        )

    if not table_exists("project_tasks"):
        op.create_table(
            "project_tasks",
            sa.Column("uid", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("project_uid", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("employee_uid", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("project_assignment_uid", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("date", sa.Date(), nullable=True),
            sa.Column("hour_work", sa.Integer(), nullable=False),
            sa.Column("task_completed", sa.Integer(), nullable=False),
            sa.Column("task_inprogress", sa.Integer(), nullable=False),
            sa.Column("task_rework", sa.Integer(), nullable=False),
            sa.Column("task_approved", sa.Integer(), nullable=False),
            sa.Column("task_rejected", sa.Integer(), nullable=False),
            sa.Column("task_reviewed", sa.Integer(), nullable=False),
            sa.Column("remarks", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint("uid", name="pk_project_tasks"),
        )

    create_foreign_key_if_not_exists(
        constraint_name="fk_project_tasks_created_by_users",
        source_table="project_tasks",
        referent_table="users",
        local_cols=["created_by"],
        remote_cols=["uid"],
    )
    create_foreign_key_if_not_exists(
        constraint_name="fk_project_tasks_project_uid_projects",
        source_table="project_tasks",
        referent_table="projects",
        local_cols=["project_uid"],
        remote_cols=["uid"],
        ondelete="CASCADE",
    )
    create_foreign_key_if_not_exists(
        constraint_name="fk_project_tasks_employee_uid_employees",
        source_table="project_tasks",
        referent_table="employees",
        local_cols=["employee_uid"],
        remote_cols=["uid"],
        ondelete="CASCADE",
    )
    create_foreign_key_if_not_exists(
        constraint_name="fk_project_tasks_project_assignment_uid_project_assignments",
        source_table="project_tasks",
        referent_table="project_assignments",
        local_cols=["project_assignment_uid"],
        remote_cols=["uid"],
        ondelete="SET NULL",
    )

    if not index_exists("project_tasks", "ix_project_tasks_created_by"):
        op.create_index("ix_project_tasks_created_by", "project_tasks", ["created_by"], unique=False)

    if not index_exists("project_tasks", "ix_project_tasks_project_uid"):
        op.create_index("ix_project_tasks_project_uid", "project_tasks", ["project_uid"], unique=False)

    if not index_exists("project_tasks", "ix_project_tasks_employee_uid"):
        op.create_index("ix_project_tasks_employee_uid", "project_tasks", ["employee_uid"], unique=False)

    if not index_exists("project_tasks", "ix_project_tasks_project_assignment_uid"):
        op.create_index(
            "ix_project_tasks_project_assignment_uid",
            "project_tasks",
            ["project_assignment_uid"],
            unique=False,
        )


def downgrade() -> None:
    """Downgrade schema."""

    if table_exists("project_tasks"):
        op.drop_table("project_tasks")

    if table_exists("project_assignments"):
        op.drop_table("project_assignments")

    if table_exists("projects"):
        op.drop_table("projects")