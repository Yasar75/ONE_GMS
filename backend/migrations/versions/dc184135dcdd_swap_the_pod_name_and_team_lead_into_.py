"""swap the pod_name and team_lead from projects to project_assignments

Revision ID: dc184135dcdd
Revises: 93d3d7d9c6e1
Create Date: 2026-04-06 21:19:50.098320
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from migrations.helpers import (
    add_column_if_not_exists,
    drop_column_if_exists,
    column_exists,
)

# revision identifiers, used by Alembic.
revision: str = "dc184135dcdd"
down_revision: Union[str, Sequence[str], None] = "93d3d7d9c6e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) Add columns into project_assignments if not already present
    add_column_if_not_exists(
        "project_assignments",
        sa.Column("pod_name", sa.Text(), nullable=True),
    )

    add_column_if_not_exists(
        "project_assignments",
        sa.Column("team_lead", sa.Text(), nullable=True),
    )

    # 2) Backfill existing data from projects -> project_assignments
    if column_exists("projects", "pod_name") and column_exists("project_assignments", "pod_name"):
        op.execute(
            sa.text(
                """
                UPDATE project_assignments pa
                SET pod_name = COALESCE(pa.pod_name, p.pod_name)
                FROM projects p
                WHERE pa.project_uid = p.uid
                """
            )
        )

    if column_exists("projects", "team_lead") and column_exists("project_assignments", "team_lead"):
        op.execute(
            sa.text(
                """
                UPDATE project_assignments pa
                SET team_lead = COALESCE(pa.team_lead, p.team_lead)
                FROM projects p
                WHERE pa.project_uid = p.uid
                """
            )
        )

    # 3) Drop columns from projects
    drop_column_if_exists("projects", "pod_name")
    drop_column_if_exists("projects", "team_lead")


def downgrade() -> None:
    # 1) Add columns back to projects if not already present
    add_column_if_not_exists(
        "projects",
        sa.Column("pod_name", sa.Text(), nullable=True),
    )

    add_column_if_not_exists(
        "projects",
        sa.Column("team_lead", sa.Text(), nullable=True),
    )

    # 2) Backfill existing data from project_assignments -> projects
    # If multiple assignments exist for one project, MIN() will keep one non-null value
    if column_exists("project_assignments", "pod_name") and column_exists("projects", "pod_name"):
        op.execute(
            sa.text(
                """
                UPDATE projects p
                SET pod_name = src.pod_name
                FROM (
                    SELECT project_uid, MIN(pod_name) AS pod_name
                    FROM project_assignments
                    WHERE pod_name IS NOT NULL
                    GROUP BY project_uid
                ) AS src
                WHERE p.uid = src.project_uid
                """
            )
        )

    if column_exists("project_assignments", "team_lead") and column_exists("projects", "team_lead"):
        op.execute(
            sa.text(
                """
                UPDATE projects p
                SET team_lead = src.team_lead
                FROM (
                    SELECT project_uid, MIN(team_lead) AS team_lead
                    FROM project_assignments
                    WHERE team_lead IS NOT NULL
                    GROUP BY project_uid
                ) AS src
                WHERE p.uid = src.project_uid
                """
            )
        )

    # 3) Drop columns from project_assignments
    drop_column_if_exists("project_assignments", "pod_name")
    drop_column_if_exists("project_assignments", "team_lead")