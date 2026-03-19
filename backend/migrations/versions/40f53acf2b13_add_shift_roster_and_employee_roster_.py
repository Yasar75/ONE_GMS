"""add shift_roster and employee_roster table

Revision ID: 40f53acf2b13
Revises: 7158c742d42e
Create Date: 2026-03-05 22:06:02.613231
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from migrations.helpers import (
    table_exists,
    index_exists,
    constraint_exists,
    drop_constraint_if_exists,
)

# revision identifiers, used by Alembic.
revision: str = "40f53acf2b13"
down_revision: Union[str, Sequence[str], None] = "7158c742d42e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ---------
# Names (keep stable for safe upgrade/downgrade)
# ---------
SHIFT_ROSTER_TABLE = "shift_roster"
EMP_SHIFTS_TABLE = "employees_shifts"

UQ_SHIFT_ROSTER_USER_CODE = "uq_shift_roster_user_uid_code"
UQ_EMPLOYEE_SHIFT_PAIR = "uq_employees_shifts_employee_uid_shift_uid"

FK_SHIFT_ROSTER_USER = "fk_shift_roster_user_uid_users"
FK_EMP_SHIFTS_EMPLOYEE = "fk_employees_shifts_employee_uid_employees"
FK_EMP_SHIFTS_SHIFT = "fk_employees_shifts_shift_uid_shift_roster"
FK_EMP_SHIFTS_USER = "fk_employees_shifts_user_uid_users"

IX_SHIFT_ROSTER_CODE = "ix_shift_roster_code"
IX_SHIFT_ROSTER_USER_UID = "ix_shift_roster_user_uid"

IX_EMP_SHIFTS_EMPLOYEE_UID = "ix_employees_shifts_employee_uid"
IX_EMP_SHIFTS_SHIFT_UID = "ix_employees_shifts_shift_uid"
IX_EMP_SHIFTS_USER_UID = "ix_employees_shifts_user_uid"


def upgrade() -> None:
    # -------------------
    # 1) shift_roster
    # -------------------
    if not table_exists(SHIFT_ROSTER_TABLE):
        op.create_table(
            SHIFT_ROSTER_TABLE,
            sa.Column("uid", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("code", sa.String(length=20), nullable=False),
            sa.Column("name", sa.String(length=80), nullable=False),
            sa.Column("start_time", sa.Time(), nullable=False),
            sa.Column("end_time", sa.Time(), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            sa.Column("user_uid", postgresql.UUID(as_uuid=True), nullable=False),
            sa.ForeignKeyConstraint(
                ["user_uid"],
                ["users.uid"],
                name=FK_SHIFT_ROSTER_USER,
                ondelete="RESTRICT",
            ),
            sa.UniqueConstraint("user_uid", "code", name=UQ_SHIFT_ROSTER_USER_CODE),
        )

    # indexes (idempotent)
    if table_exists(SHIFT_ROSTER_TABLE):
        if not index_exists(SHIFT_ROSTER_TABLE, IX_SHIFT_ROSTER_CODE):
            op.create_index(IX_SHIFT_ROSTER_CODE, SHIFT_ROSTER_TABLE, ["code"])
        if not index_exists(SHIFT_ROSTER_TABLE, IX_SHIFT_ROSTER_USER_UID):
            op.create_index(IX_SHIFT_ROSTER_USER_UID, SHIFT_ROSTER_TABLE, ["user_uid"])

    # -------------------
    # 2) employees_shifts
    # -------------------
    if not table_exists(EMP_SHIFTS_TABLE):
        op.create_table(
            EMP_SHIFTS_TABLE,
            sa.Column("uid", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("employee_uid", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("shift_uid", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            sa.Column("user_uid", postgresql.UUID(as_uuid=True), nullable=False),
            sa.ForeignKeyConstraint(
                ["employee_uid"],
                ["employees.uid"],
                name=FK_EMP_SHIFTS_EMPLOYEE,
                ondelete="CASCADE",
            ),
            sa.ForeignKeyConstraint(
                ["shift_uid"],
                ["shift_roster.uid"],
                name=FK_EMP_SHIFTS_SHIFT,
                ondelete="RESTRICT",
            ),
            sa.ForeignKeyConstraint(
                ["user_uid"],
                ["users.uid"],
                name=FK_EMP_SHIFTS_USER,
                ondelete="RESTRICT",
            ),
            sa.UniqueConstraint("employee_uid", "shift_uid", name=UQ_EMPLOYEE_SHIFT_PAIR),
        )

    # indexes (idempotent)
    if table_exists(EMP_SHIFTS_TABLE):
        if not index_exists(EMP_SHIFTS_TABLE, IX_EMP_SHIFTS_EMPLOYEE_UID):
            op.create_index(IX_EMP_SHIFTS_EMPLOYEE_UID, EMP_SHIFTS_TABLE, ["employee_uid"])
        if not index_exists(EMP_SHIFTS_TABLE, IX_EMP_SHIFTS_SHIFT_UID):
            op.create_index(IX_EMP_SHIFTS_SHIFT_UID, EMP_SHIFTS_TABLE, ["shift_uid"])
        if not index_exists(EMP_SHIFTS_TABLE, IX_EMP_SHIFTS_USER_UID):
            op.create_index(IX_EMP_SHIFTS_USER_UID, EMP_SHIFTS_TABLE, ["user_uid"])


def downgrade() -> None:
    # Drop child table first (FK dependency)
    if table_exists(EMP_SHIFTS_TABLE):
        # optional explicit constraint drops (safe even if DB auto-drops on drop_table)
        drop_constraint_if_exists(EMP_SHIFTS_TABLE, UQ_EMPLOYEE_SHIFT_PAIR, "unique")
        drop_constraint_if_exists(EMP_SHIFTS_TABLE, FK_EMP_SHIFTS_EMPLOYEE, "foreignkey")
        drop_constraint_if_exists(EMP_SHIFTS_TABLE, FK_EMP_SHIFTS_SHIFT, "foreignkey")
        drop_constraint_if_exists(EMP_SHIFTS_TABLE, FK_EMP_SHIFTS_USER, "foreignkey")
        op.drop_table(EMP_SHIFTS_TABLE)

    if table_exists(SHIFT_ROSTER_TABLE):
        drop_constraint_if_exists(SHIFT_ROSTER_TABLE, UQ_SHIFT_ROSTER_USER_CODE, "unique")
        drop_constraint_if_exists(SHIFT_ROSTER_TABLE, FK_SHIFT_ROSTER_USER, "foreignkey")
        op.drop_table(SHIFT_ROSTER_TABLE)