"""add attendance related tables

Revision ID: ba16c150e2d4
Revises: 48f92ccf8be7
Create Date: 2026-03-09 20:43:06.761878
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from migrations.helpers import (
    add_column_if_not_exists,
    column_exists,
    constraint_exists,
    drop_column_if_exists,
    drop_constraint_if_exists,
    get_fk_constraints_for_column,
    index_exists,
    is_postgres,
    table_exists,
    _create_pg_enum_if_not_exists,
    _drop_pg_enum_if_exists,
)

# revision identifiers, used by Alembic.
revision: str = "ba16c150e2d4"
down_revision: Union[str, Sequence[str], None] = "48f92ccf8be7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


ATTENDANCE_STATUS_NEW = "attendance_status"
ATTENDANCE_STATUS_OLD = "attendance_status_old"
PUNCH_TYPE_ENUM = "attendance_punch_type"
REGULARIZATION_STATUS_ENUM = "attendance_regularization_status"
INOUT_STATUS_ENUM = "inout_status"


def _create_index_if_not_exists(index_name: str, table_name: str, columns: list[str]) -> None:
    if table_exists(table_name) and not index_exists(table_name, index_name):
        op.create_index(index_name, table_name, columns, unique=False)


def _drop_index_if_exists(index_name: str, table_name: str) -> None:
    if table_exists(table_name) and index_exists(table_name, index_name):
        op.drop_index(index_name, table_name=table_name)


def _create_unique_if_not_exists(table_name: str, constraint_name: str, columns: list[str]) -> None:
    if table_exists(table_name) and not constraint_exists(constraint_name, table_name):
        op.create_unique_constraint(constraint_name, table_name, columns)


def _create_fk_if_not_exists(
    table_name: str,
    constraint_name: str,
    referent_table: str,
    local_cols: list[str],
    remote_cols: list[str],
    ondelete: str | None = None,
) -> None:
    if table_exists(table_name) and not constraint_exists(constraint_name, table_name):
        op.create_foreign_key(
            constraint_name,
            table_name,
            referent_table,
            local_cols,
            remote_cols,
            ondelete=ondelete,
        )


def _drop_all_fks_for_column(table_name: str, column_name: str) -> None:
    if not table_exists(table_name):
        return
    for fk_name in get_fk_constraints_for_column(table_name, column_name):
        op.drop_constraint(fk_name, table_name, type_="foreignkey")


def _migrate_attendance_status_enum_upgrade() -> None:
    """
    Old enum values:
        Present, Absent, HalfDay, Leave

    New enum values:
        Present, Absent, PendingRegularization

    Since PostgreSQL enums cannot safely remove values in-place,
    rename old type -> create new type -> cast column.
    """
    if not is_postgres() or not table_exists("attendance") or not column_exists("attendance", "status"):
        return

    conn = op.get_bind()

    # detect whether old enum type exists
    enum_exists = conn.execute(
        sa.text(
            """
            SELECT 1
            FROM pg_type
            WHERE typname = :enum_name
            """
        ),
        {"enum_name": ATTENDANCE_STATUS_NEW},
    ).scalar()

    if not enum_exists:
        _create_pg_enum_if_not_exists(
            ATTENDANCE_STATUS_NEW,
            ["Present", "Absent", "PendingRegularization"],
        )
        return

    # rename existing enum only once
    old_enum_exists = conn.execute(
        sa.text(
            """
            SELECT 1
            FROM pg_type
            WHERE typname = :enum_name
            """
        ),
        {"enum_name": ATTENDANCE_STATUS_OLD},
    ).scalar()

    if not old_enum_exists:
        op.execute(
            sa.text(
                f'ALTER TYPE "{ATTENDANCE_STATUS_NEW}" RENAME TO "{ATTENDANCE_STATUS_OLD}"'
            )
        )

    _create_pg_enum_if_not_exists(
        ATTENDANCE_STATUS_NEW,
        ["Present", "Absent", "PendingRegularization"],
    )

    # Convert values that don't exist in new enum.
    # Adjust mapping here if your business wants a different target.
    op.execute(
        sa.text(
            """
            UPDATE attendance
            SET status = CASE
                WHEN status::text IN ('HalfDay', 'Leave') THEN 'Absent'
                ELSE status::text
            END::text::attendance_status_old
            """
        )
    )

    op.execute(
        sa.text(
            """
            ALTER TABLE attendance
            ALTER COLUMN status DROP DEFAULT
            """
        )
    )

    op.execute(
        sa.text(
            """
            ALTER TABLE attendance
            ALTER COLUMN status TYPE attendance_status
            USING (
                CASE
                    WHEN status::text IN ('HalfDay', 'Leave') THEN 'Absent'
                    ELSE status::text
                END
            )::attendance_status
            """
        )
    )

    op.execute(
        sa.text(
            """
            ALTER TABLE attendance
            ALTER COLUMN status SET DEFAULT 'Absent'
            """
        )
    )

    _drop_pg_enum_if_exists(ATTENDANCE_STATUS_OLD)


def _migrate_attendance_status_enum_downgrade() -> None:
    """
    Reverse:
    New enum values:
        Present, Absent, PendingRegularization

    Old enum values:
        Present, Absent, HalfDay, Leave
    """
    if not is_postgres() or not table_exists("attendance") or not column_exists("attendance", "status"):
        return

    conn = op.get_bind()

    old_exists = conn.execute(
        sa.text(
            """
            SELECT 1
            FROM pg_type
            WHERE typname = :enum_name
            """
        ),
        {"enum_name": ATTENDANCE_STATUS_OLD},
    ).scalar()

    if not old_exists:
        _create_pg_enum_if_not_exists(
            ATTENDANCE_STATUS_OLD,
            ["Present", "Absent", "HalfDay", "Leave"],
        )

    op.execute(sa.text("""ALTER TABLE attendance ALTER COLUMN status DROP DEFAULT"""))

    op.execute(
        sa.text(
            """
            ALTER TABLE attendance
            ALTER COLUMN status TYPE attendance_status_old
            USING (
                CASE
                    WHEN status::text = 'PendingRegularization' THEN 'Absent'
                    ELSE status::text
                END
            )::attendance_status_old
            """
        )
    )

    op.execute(
        sa.text(
            f'DROP TYPE IF EXISTS "{ATTENDANCE_STATUS_NEW}"'
        )
    )
    op.execute(
        sa.text(
            f'ALTER TYPE "{ATTENDANCE_STATUS_OLD}" RENAME TO "{ATTENDANCE_STATUS_NEW}"'
        )
    )

    op.execute(
        sa.text(
            """
            ALTER TABLE attendance
            ALTER COLUMN status SET DEFAULT 'Present'
            """
        )
    )


def upgrade() -> None:
    # -------------------------------------------------------------------------
    # Create required enums first
    # -------------------------------------------------------------------------
    _create_pg_enum_if_not_exists(PUNCH_TYPE_ENUM, ["IN", "OUT"])
    _create_pg_enum_if_not_exists(REGULARIZATION_STATUS_ENUM, ["Pending", "Approved", "Rejected"])

    # Handle changed attendance_status enum safely
    _migrate_attendance_status_enum_upgrade()

    # -------------------------------------------------------------------------
    # Create new tables conditionally
    # -------------------------------------------------------------------------
    if not table_exists("attendance_punch_logs"):
        op.create_table(
            "attendance_punch_logs",
            sa.Column("uid", sa.UUID(), nullable=False),
            sa.Column("user_uid", sa.Uuid(), nullable=False),
            sa.Column("employee_uid", sa.UUID(), nullable=False),
            sa.Column("attendance_uid", sa.UUID(), nullable=False),
            sa.Column("attendance_date", sa.DATE(), nullable=False),
            sa.Column(
                "punch_type",
                postgresql.ENUM("IN", "OUT", name=PUNCH_TYPE_ENUM, create_type=False),
                nullable=False,
            ),
            sa.Column("punch_time", sa.DateTime(timezone=True), nullable=False),
            sa.Column("is_valid", sa.Boolean(), server_default=sa.text("true"), nullable=False),
            sa.Column("invalid_reason", sa.Text(), nullable=True),
            sa.Column("source", sa.VARCHAR(length=20), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["attendance_uid"], ["attendance.uid"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["employee_uid"], ["employees.uid"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_uid"], ["users.uid"]),
            sa.PrimaryKeyConstraint("uid"),
        )

    _create_index_if_not_exists("ix_attendance_punch_logs_attendance_date", "attendance_punch_logs", ["attendance_date"])
    _create_index_if_not_exists("ix_attendance_punch_logs_attendance_uid", "attendance_punch_logs", ["attendance_uid"])
    _create_index_if_not_exists("ix_attendance_punch_logs_employee_uid", "attendance_punch_logs", ["employee_uid"])
    _create_index_if_not_exists("ix_attendance_punch_logs_punch_time", "attendance_punch_logs", ["punch_time"])
    _create_index_if_not_exists("ix_attendance_punch_logs_user_uid", "attendance_punch_logs", ["user_uid"])

    if not table_exists("attendance_regularizations"):
        op.create_table(
            "attendance_regularizations",
            sa.Column("uid", sa.UUID(), nullable=False),
            sa.Column("user_uid", sa.Uuid(), nullable=False),
            sa.Column("employee_uid", sa.UUID(), nullable=False),
            sa.Column("attendance_uid", sa.UUID(), nullable=True),
            sa.Column("regularization_date", sa.DATE(), nullable=False),
            sa.Column("requested_punch_in", sa.DateTime(timezone=True), nullable=True),
            sa.Column("requested_punch_out", sa.DateTime(timezone=True), nullable=True),
            sa.Column("requested_worked_hours", sa.Numeric(precision=6, scale=2), nullable=True),
            sa.Column("reason", sa.Text(), nullable=False),
            sa.Column(
                "status",
                postgresql.ENUM(
                    "Pending",
                    "Approved",
                    "Rejected",
                    name=REGULARIZATION_STATUS_ENUM,
                    create_type=False,
                ),
                server_default="Pending",
                nullable=False,
            ),
            sa.Column("approver_employee_uid", sa.UUID(), nullable=True),
            sa.Column("reviewer_note", sa.Text(), nullable=True),
            sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["approver_employee_uid"], ["employees.uid"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["attendance_uid"], ["attendance.uid"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["employee_uid"], ["employees.uid"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_uid"], ["users.uid"]),
            sa.PrimaryKeyConstraint("uid"),
        )

    _create_index_if_not_exists(
        "ix_attendance_regularizations_approver_employee_uid",
        "attendance_regularizations",
        ["approver_employee_uid"],
    )
    _create_index_if_not_exists(
        "ix_attendance_regularizations_attendance_uid",
        "attendance_regularizations",
        ["attendance_uid"],
    )
    _create_index_if_not_exists(
        "ix_attendance_regularizations_employee_uid",
        "attendance_regularizations",
        ["employee_uid"],
    )
    _create_index_if_not_exists(
        "ix_attendance_regularizations_regularization_date",
        "attendance_regularizations",
        ["regularization_date"],
    )
    _create_index_if_not_exists(
        "ix_attendance_regularizations_user_uid",
        "attendance_regularizations",
        ["user_uid"],
    )

    if not table_exists("attendance_regularization_logs"):
        op.create_table(
            "attendance_regularization_logs",
            sa.Column("uid", sa.UUID(), nullable=False),
            sa.Column("regularization_uid", sa.UUID(), nullable=False),
            sa.Column("actor_employee_uid", sa.UUID(), nullable=True),
            sa.Column("action", sa.VARCHAR(length=30), nullable=False),
            sa.Column("note", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["actor_employee_uid"], ["employees.uid"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["regularization_uid"], ["attendance_regularizations.uid"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("uid"),
        )

    _create_index_if_not_exists(
        "ix_attendance_regularization_logs_actor_employee_uid",
        "attendance_regularization_logs",
        ["actor_employee_uid"],
    )
    _create_index_if_not_exists(
        "ix_attendance_regularization_logs_regularization_uid",
        "attendance_regularization_logs",
        ["regularization_uid"],
    )

    # -------------------------------------------------------------------------
    # Add new columns to attendance safely
    # -------------------------------------------------------------------------
    add_column_if_not_exists("attendance", sa.Column("attendance_date", sa.DATE(), nullable=True))
    add_column_if_not_exists("attendance", sa.Column("first_punch_in", sa.DateTime(timezone=True), nullable=True))
    add_column_if_not_exists("attendance", sa.Column("last_punch_out", sa.DateTime(timezone=True), nullable=True))
    add_column_if_not_exists(
        "attendance",
        sa.Column("total_assigned_shift_hours", sa.Numeric(precision=6, scale=2), server_default="0", nullable=False),
    )
    add_column_if_not_exists(
        "attendance",
        sa.Column("total_worked_hours", sa.Numeric(precision=6, scale=2), server_default="0", nullable=False),
    )
    add_column_if_not_exists(
        "attendance",
        sa.Column("is_regularized", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    add_column_if_not_exists("attendance", sa.Column("remarks", sa.Text(), nullable=True))

    # -------------------------------------------------------------------------
    # Backfill new columns from old columns
    # -------------------------------------------------------------------------
    if column_exists("attendance", "att_date") and column_exists("attendance", "attendance_date"):
        op.execute(
            sa.text(
                """
                UPDATE attendance
                SET attendance_date = att_date
                WHERE attendance_date IS NULL
                """
            )
        )

    if (
        column_exists("attendance", "att_date")
        and column_exists("attendance", "check_in")
        and column_exists("attendance", "first_punch_in")
    ):
        op.execute(
            sa.text(
                """
                UPDATE attendance
                SET first_punch_in = (att_date::timestamp + check_in)
                WHERE check_in IS NOT NULL
                  AND first_punch_in IS NULL
                """
            )
        )

    if (
        column_exists("attendance", "att_date")
        and column_exists("attendance", "check_out")
        and column_exists("attendance", "last_punch_out")
    ):
        op.execute(
            sa.text(
                """
                UPDATE attendance
                SET last_punch_out = (att_date::timestamp + check_out)
                WHERE check_out IS NOT NULL
                  AND last_punch_out IS NULL
                """
            )
        )

    if column_exists("attendance", "working_hours") and column_exists("attendance", "total_worked_hours"):
        op.execute(
            sa.text(
                """
                UPDATE attendance
                SET total_worked_hours = COALESCE(working_hours, 0)
                WHERE total_worked_hours = 0
                """
            )
        )

    # make attendance_date non-null after backfill
    if column_exists("attendance", "attendance_date"):
        op.alter_column("attendance", "attendance_date", nullable=False)

    # -------------------------------------------------------------------------
    # Unique/index handling
    # -------------------------------------------------------------------------
    _drop_index_if_exists("ix_attendance_att_date", "attendance")
    drop_constraint_if_exists("attendance", "uq_attendance_employee_uid_att_date", "unique")

    _create_index_if_not_exists("ix_attendance_attendance_date", "attendance", ["attendance_date"])
    _create_unique_if_not_exists(
        "attendance",
        "uq_attendance_employee_uid_attendance_date",
        ["employee_uid", "attendance_date"],
    )

    # -------------------------------------------------------------------------
    # FK handling for attendance.user_uid
    # -------------------------------------------------------------------------
    if column_exists("attendance", "user_uid"):
        _drop_all_fks_for_column("attendance", "user_uid")
        _create_fk_if_not_exists(
            "attendance",
            "attendance_user_uid_fkey",
            "users",
            ["user_uid"],
            ["uid"],
            ondelete=None,
        )

    # -------------------------------------------------------------------------
    # Drop old columns safely
    # -------------------------------------------------------------------------
    drop_column_if_exists("attendance", "check_in_status")
    drop_column_if_exists("attendance", "check_in")
    drop_column_if_exists("attendance", "att_date")
    drop_column_if_exists("attendance", "working_hours")
    drop_column_if_exists("attendance", "check_out")
    drop_column_if_exists("attendance", "shift_punches")
    drop_column_if_exists("attendance", "check_out_status")

    # Optional: drop old enum if no longer used
    if is_postgres():
        conn = op.get_bind()
        inout_enum_still_used = conn.execute(
            sa.text(
                """
                SELECT COUNT(*) 
                FROM pg_type t
                JOIN pg_depend d ON d.refobjid = t.oid
                WHERE t.typname = :enum_name
                """
            ),
            {"enum_name": INOUT_STATUS_ENUM},
        ).scalar()

        if not inout_enum_still_used:
            _drop_pg_enum_if_exists(INOUT_STATUS_ENUM)


def downgrade() -> None:
    # -------------------------------------------------------------------------
    # Recreate old columns
    # -------------------------------------------------------------------------
    add_column_if_not_exists(
        "attendance",
        sa.Column(
            "check_out_status",
            postgresql.ENUM("OnTime", "Late", "Early", "Missing", name=INOUT_STATUS_ENUM, create_type=False),
            nullable=True,
        ),
    )
    add_column_if_not_exists(
        "attendance",
        sa.Column("shift_punches", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    add_column_if_not_exists("attendance", sa.Column("check_out", postgresql.TIME(), nullable=True))
    add_column_if_not_exists(
        "attendance",
        sa.Column("working_hours", sa.NUMERIC(precision=5, scale=2), server_default=sa.text("'0'::numeric"), nullable=False),
    )
    add_column_if_not_exists("attendance", sa.Column("att_date", sa.DATE(), nullable=True))
    add_column_if_not_exists("attendance", sa.Column("check_in", postgresql.TIME(), nullable=True))
    add_column_if_not_exists(
        "attendance",
        sa.Column(
            "check_in_status",
            postgresql.ENUM("OnTime", "Late", "Early", "Missing", name=INOUT_STATUS_ENUM, create_type=False),
            nullable=True,
        ),
    )

    if is_postgres():
        _create_pg_enum_if_not_exists(INOUT_STATUS_ENUM, ["OnTime", "Late", "Early", "Missing"])

    # -------------------------------------------------------------------------
    # Backfill old columns from new columns
    # -------------------------------------------------------------------------
    if column_exists("attendance", "attendance_date") and column_exists("attendance", "att_date"):
        op.execute(
            sa.text(
                """
                UPDATE attendance
                SET att_date = attendance_date
                WHERE att_date IS NULL
                """
            )
        )

    if column_exists("attendance", "first_punch_in") and column_exists("attendance", "check_in"):
        op.execute(
            sa.text(
                """
                UPDATE attendance
                SET check_in = first_punch_in::time
                WHERE first_punch_in IS NOT NULL
                  AND check_in IS NULL
                """
            )
        )

    if column_exists("attendance", "last_punch_out") and column_exists("attendance", "check_out"):
        op.execute(
            sa.text(
                """
                UPDATE attendance
                SET check_out = last_punch_out::time
                WHERE last_punch_out IS NOT NULL
                  AND check_out IS NULL
                """
            )
        )

    if column_exists("attendance", "total_worked_hours") and column_exists("attendance", "working_hours"):
        op.execute(
            sa.text(
                """
                UPDATE attendance
                SET working_hours = COALESCE(total_worked_hours, 0)
                WHERE working_hours = 0
                """
            )
        )

    if column_exists("attendance", "att_date"):
        op.alter_column("attendance", "att_date", nullable=False)

    # -------------------------------------------------------------------------
    # Restore old enum values for status
    # -------------------------------------------------------------------------
    _migrate_attendance_status_enum_downgrade()

    # -------------------------------------------------------------------------
    # Constraint/index changes
    # -------------------------------------------------------------------------
    _drop_all_fks_for_column("attendance", "user_uid")
    _create_fk_if_not_exists(
        "attendance",
        "attendance_user_uid_fkey",
        "users",
        ["user_uid"],
        ["uid"],
        ondelete="RESTRICT",
    )

    _drop_index_if_exists("ix_attendance_attendance_date", "attendance")
    drop_constraint_if_exists("attendance", "uq_attendance_employee_uid_attendance_date", "unique")

    _create_unique_if_not_exists(
        "attendance",
        "uq_attendance_employee_uid_att_date",
        ["employee_uid", "att_date"],
    )
    _create_index_if_not_exists("ix_attendance_att_date", "attendance", ["att_date"])

    # -------------------------------------------------------------------------
    # Drop new columns
    # -------------------------------------------------------------------------
    drop_column_if_exists("attendance", "remarks")
    drop_column_if_exists("attendance", "is_regularized")
    drop_column_if_exists("attendance", "total_worked_hours")
    drop_column_if_exists("attendance", "total_assigned_shift_hours")
    drop_column_if_exists("attendance", "last_punch_out")
    drop_column_if_exists("attendance", "first_punch_in")
    drop_column_if_exists("attendance", "attendance_date")

    # -------------------------------------------------------------------------
    # Drop newly created tables
    # -------------------------------------------------------------------------
    _drop_index_if_exists("ix_attendance_regularization_logs_regularization_uid", "attendance_regularization_logs")
    _drop_index_if_exists("ix_attendance_regularization_logs_actor_employee_uid", "attendance_regularization_logs")
    if table_exists("attendance_regularization_logs"):
        op.drop_table("attendance_regularization_logs")

    _drop_index_if_exists("ix_attendance_regularizations_user_uid", "attendance_regularizations")
    _drop_index_if_exists("ix_attendance_regularizations_regularization_date", "attendance_regularizations")
    _drop_index_if_exists("ix_attendance_regularizations_employee_uid", "attendance_regularizations")
    _drop_index_if_exists("ix_attendance_regularizations_attendance_uid", "attendance_regularizations")
    _drop_index_if_exists("ix_attendance_regularizations_approver_employee_uid", "attendance_regularizations")
    if table_exists("attendance_regularizations"):
        op.drop_table("attendance_regularizations")

    _drop_index_if_exists("ix_attendance_punch_logs_user_uid", "attendance_punch_logs")
    _drop_index_if_exists("ix_attendance_punch_logs_punch_time", "attendance_punch_logs")
    _drop_index_if_exists("ix_attendance_punch_logs_employee_uid", "attendance_punch_logs")
    _drop_index_if_exists("ix_attendance_punch_logs_attendance_uid", "attendance_punch_logs")
    _drop_index_if_exists("ix_attendance_punch_logs_attendance_date", "attendance_punch_logs")
    if table_exists("attendance_punch_logs"):
        op.drop_table("attendance_punch_logs")

    # -------------------------------------------------------------------------
    # Drop enums created for new tables
    # -------------------------------------------------------------------------
    _drop_pg_enum_if_exists(REGULARIZATION_STATUS_ENUM)
    _drop_pg_enum_if_exists(PUNCH_TYPE_ENUM)