"""add leave type in Attendance table

Revision ID: 5838b7b504e3
Revises: ba16c150e2d4
Create Date: 2026-03-09 23:51:08.134562
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from migrations.helpers import (
    add_column_if_not_exists,
    column_exists,
    create_foreign_key_if_not_exists,
    drop_column_if_exists,
    drop_constraint_if_exists,
    index_exists,
)

# revision identifiers, used by Alembic.
revision: str = "5838b7b504e3"
down_revision: Union[str, Sequence[str], None] = "ba16c150e2d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


ATTENDANCE_TABLE = "attendance"
LEAVE_REQUEST_TABLE = "leave_request"
LEAVE_TYPES_TABLE = "leave_types"

LEAVE_REQUEST_UID_COL = "leave_request_uid"
LEAVE_TYPE_UID_COL = "leave_type_uid"

IX_ATTENDANCE_LEAVE_REQUEST_UID = "ix_attendance_leave_request_uid"
IX_ATTENDANCE_LEAVE_TYPE_UID = "ix_attendance_leave_type_uid"

FK_ATTENDANCE_LEAVE_REQUEST_UID = "fk_attendance_leave_request_uid"
FK_ATTENDANCE_LEAVE_TYPE_UID = "fk_attendance_leave_type_uid"


def upgrade() -> None:
    """Upgrade schema."""

    # 1. Add columns safely
    add_column_if_not_exists(
        ATTENDANCE_TABLE,
        sa.Column(LEAVE_REQUEST_UID_COL, sa.UUID(), nullable=True),
    )
    add_column_if_not_exists(
        ATTENDANCE_TABLE,
        sa.Column(LEAVE_TYPE_UID_COL, sa.UUID(), nullable=True),
    )

    # 2. Create indexes safely
    if column_exists(ATTENDANCE_TABLE, LEAVE_REQUEST_UID_COL) and not index_exists(
        ATTENDANCE_TABLE, IX_ATTENDANCE_LEAVE_REQUEST_UID
    ):
        op.create_index(
            IX_ATTENDANCE_LEAVE_REQUEST_UID,
            ATTENDANCE_TABLE,
            [LEAVE_REQUEST_UID_COL],
            unique=False,
        )

    if column_exists(ATTENDANCE_TABLE, LEAVE_TYPE_UID_COL) and not index_exists(
        ATTENDANCE_TABLE, IX_ATTENDANCE_LEAVE_TYPE_UID
    ):
        op.create_index(
            IX_ATTENDANCE_LEAVE_TYPE_UID,
            ATTENDANCE_TABLE,
            [LEAVE_TYPE_UID_COL],
            unique=False,
        )

    # 3. Create foreign keys safely
    create_foreign_key_if_not_exists(
        constraint_name=FK_ATTENDANCE_LEAVE_REQUEST_UID,
        source_table=ATTENDANCE_TABLE,
        referent_table=LEAVE_REQUEST_TABLE,
        local_cols=[LEAVE_REQUEST_UID_COL],
        remote_cols=["uid"],
        ondelete="SET NULL",
    )

    create_foreign_key_if_not_exists(
        constraint_name=FK_ATTENDANCE_LEAVE_TYPE_UID,
        source_table=ATTENDANCE_TABLE,
        referent_table=LEAVE_TYPES_TABLE,
        local_cols=[LEAVE_TYPE_UID_COL],
        remote_cols=["uid"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    """Downgrade schema."""

    # 1. Drop foreign keys safely
    drop_constraint_if_exists(
        table_name=ATTENDANCE_TABLE,
        constraint_name=FK_ATTENDANCE_LEAVE_REQUEST_UID,
        constraint_type="foreignkey",
    )
    drop_constraint_if_exists(
        table_name=ATTENDANCE_TABLE,
        constraint_name=FK_ATTENDANCE_LEAVE_TYPE_UID,
        constraint_type="foreignkey",
    )

    # 2. Drop indexes safely
    if index_exists(ATTENDANCE_TABLE, IX_ATTENDANCE_LEAVE_REQUEST_UID):
        op.drop_index(IX_ATTENDANCE_LEAVE_REQUEST_UID, table_name=ATTENDANCE_TABLE)

    if index_exists(ATTENDANCE_TABLE, IX_ATTENDANCE_LEAVE_TYPE_UID):
        op.drop_index(IX_ATTENDANCE_LEAVE_TYPE_UID, table_name=ATTENDANCE_TABLE)

    # 3. Drop columns safely
    drop_column_if_exists(ATTENDANCE_TABLE, LEAVE_TYPE_UID_COL)
    drop_column_if_exists(ATTENDANCE_TABLE, LEAVE_REQUEST_UID_COL)