"""create Holiday, leave_type, leave_balance, leave_request table

Revision ID: 48f92ccf8be7
Revises: c842ccdaabdc
Create Date: 2026-03-08 17:19:37.278644
"""

from typing import Sequence, Union
from decimal import Decimal

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from migrations.helpers import (
    table_exists,
    column_exists,
    index_exists,
    constraint_exists,
    drop_constraint_if_exists,
    _create_pg_enum_if_not_exists,
    _drop_pg_enum_if_exists,
)

# revision identifiers, used by Alembic.
revision: str = "48f92ccf8be7"
down_revision: Union[str, Sequence[str], None] = "c842ccdaabdc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# -----------------------------
# ENUM names / values
# -----------------------------
LEAVE_REQUEST_STATUS_ENUM_NAME = "leave_request_status"
LEAVE_REQUEST_STATUS_VALUES = ["Pending", "Approved", "Rejected", "Cancelled"]

LEAVE_TYPE_CODE_ENUM_NAME = "leave_type_code"
LEAVE_TYPE_CODE_VALUES = ["EL", "CL", "SL", "ML", "PL"]

OLD_LEAVE_STATUS_ENUM_NAME = "leave_status"
OLD_LEAVE_STATUS_VALUES = ["Pending", "Approved", "Rejected", "Cancelled"]


def upgrade() -> None:
    """Upgrade schema."""

    # --------------------------------------------------
    # 1. Drop old leave_request table if it exists
    # --------------------------------------------------
    if table_exists("leave_request"):
        if index_exists("leave_request", "ix_leave_request_employee_uid"):
            op.drop_index("ix_leave_request_employee_uid", table_name="leave_request")

        if index_exists("leave_request", "ix_leave_request_end_date"):
            op.drop_index("ix_leave_request_end_date", table_name="leave_request")

        if index_exists("leave_request", "ix_leave_request_start_date"):
            op.drop_index("ix_leave_request_start_date", table_name="leave_request")

        if index_exists("leave_request", "ix_leave_request_user_uid"):
            op.drop_index("ix_leave_request_user_uid", table_name="leave_request")

        op.drop_table("leave_request")

    # old enum may still remain in postgres after table drop
    _drop_pg_enum_if_exists(OLD_LEAVE_STATUS_ENUM_NAME)

    # --------------------------------------------------
    # 2. Create required enums for new tables
    # --------------------------------------------------
    _create_pg_enum_if_not_exists(
        LEAVE_REQUEST_STATUS_ENUM_NAME,
        LEAVE_REQUEST_STATUS_VALUES,
    )
    _create_pg_enum_if_not_exists(
        LEAVE_TYPE_CODE_ENUM_NAME,
        LEAVE_TYPE_CODE_VALUES,
    )

    # --------------------------------------------------
    # 3. Create holiday_calendar
    # --------------------------------------------------
    if not table_exists("holiday_calendar"):
        op.create_table(
            "holiday_calendar",
            sa.Column(
                "uid",
                postgresql.UUID(as_uuid=True),
                primary_key=True,
                nullable=False,
                server_default=sa.text("gen_random_uuid()"),
            ),
            sa.Column("holiday_date", sa.Date(), nullable=False),
            sa.Column("name", sa.String(length=150), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column(
                "is_active",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("true"),
            ),
            sa.Column("user_uid", postgresql.UUID(as_uuid=True), nullable=False),
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
            sa.ForeignKeyConstraint(
                ["user_uid"],
                ["users.uid"],
                name="fk_holiday_calendar_user_uid_users",
                ondelete="RESTRICT",
            ),
        )

    if not index_exists("holiday_calendar", "ix_holiday_calendar_holiday_date"):
        op.create_index(
            "ix_holiday_calendar_holiday_date",
            "holiday_calendar",
            ["holiday_date"],
            unique=False,
        )

    if not index_exists("holiday_calendar", "ix_holiday_calendar_user_uid"):
        op.create_index(
            "ix_holiday_calendar_user_uid",
            "holiday_calendar",
            ["user_uid"],
            unique=False,
        )

    # --------------------------------------------------
    # 4. Create leave_types
    # --------------------------------------------------
    if not table_exists("leave_types"):
        op.create_table(
            "leave_types",
            sa.Column(
                "uid",
                postgresql.UUID(as_uuid=True),
                primary_key=True,
                nullable=False,
                server_default=sa.text("gen_random_uuid()"),
            ),
            sa.Column(
                "code",
                postgresql.ENUM(
                    *LEAVE_TYPE_CODE_VALUES,
                    name=LEAVE_TYPE_CODE_ENUM_NAME,
                    create_type=False,
                ),
                nullable=False,
            ),
            sa.Column("name", sa.String(length=100), nullable=False),
            sa.Column(
                "annual_days",
                sa.Numeric(6, 2),
                nullable=False,
                server_default=sa.text("0"),
            ),
            sa.Column(
                "auto_allocate",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("true"),
            ),
            sa.Column(
                "requires_manual_grant",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            ),
            sa.Column(
                "carry_forward_allowed",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            ),
            sa.Column("carry_forward_cap", sa.Numeric(6, 2), nullable=True),
            sa.Column(
                "is_active",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("true"),
            ),
            sa.Column("user_uid", postgresql.UUID(as_uuid=True), nullable=False),
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
            sa.ForeignKeyConstraint(
                ["user_uid"],
                ["users.uid"],
                name="fk_leave_types_user_uid_users",
                ondelete="RESTRICT",
            ),
        )

    if not index_exists("leave_types", "ix_leave_types_user_uid"):
        op.create_index(
            "ix_leave_types_user_uid",
            "leave_types",
            ["user_uid"],
            unique=False,
        )

    # Optional but recommended:
    # one code should usually exist once only
    if not constraint_exists("uq_leave_types_code", table_name="leave_types"):
        op.create_unique_constraint(
            "uq_leave_types_code",
            "leave_types",
            ["code"],
        )

    # --------------------------------------------------
    # 5. Create employee_leave_balances
    # --------------------------------------------------
    if not table_exists("employee_leave_balances"):
        op.create_table(
            "employee_leave_balances",
            sa.Column(
                "uid",
                postgresql.UUID(as_uuid=True),
                primary_key=True,
                nullable=False,
                server_default=sa.text("gen_random_uuid()"),
            ),
            sa.Column("user_uid", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("employee_uid", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("leave_type_uid", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("year", sa.Integer(), nullable=False),
            sa.Column(
                "opening_balance",
                sa.Numeric(6, 2),
                nullable=False,
                server_default=sa.text("0"),
            ),
            sa.Column(
                "annual_allocation",
                sa.Numeric(6, 2),
                nullable=False,
                server_default=sa.text("0"),
            ),
            sa.Column(
                "carry_forward_in",
                sa.Numeric(6, 2),
                nullable=False,
                server_default=sa.text("0"),
            ),
            sa.Column(
                "manual_granted",
                sa.Numeric(6, 2),
                nullable=False,
                server_default=sa.text("0"),
            ),
            sa.Column(
                "used_days",
                sa.Numeric(6, 2),
                nullable=False,
                server_default=sa.text("0"),
            ),
            sa.Column(
                "pending_days",
                sa.Numeric(6, 2),
                nullable=False,
                server_default=sa.text("0"),
            ),
            sa.Column(
                "lapsed_days",
                sa.Numeric(6, 2),
                nullable=False,
                server_default=sa.text("0"),
            ),
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
            sa.ForeignKeyConstraint(
                ["user_uid"],
                ["users.uid"],
                name="fk_employee_leave_balances_user_uid_users",
                ondelete="RESTRICT",
            ),
            sa.ForeignKeyConstraint(
                ["employee_uid"],
                ["employees.uid"],
                name="fk_employee_leave_balances_employee_uid_employees",
                ondelete="CASCADE",
            ),
            sa.ForeignKeyConstraint(
                ["leave_type_uid"],
                ["leave_types.uid"],
                name="fk_employee_leave_balances_leave_type_uid_leave_types",
                ondelete="CASCADE",
            ),
        )

    if not index_exists("employee_leave_balances", "ix_employee_leave_balances_user_uid"):
        op.create_index(
            "ix_employee_leave_balances_user_uid",
            "employee_leave_balances",
            ["user_uid"],
            unique=False,
        )

    if not index_exists("employee_leave_balances", "ix_employee_leave_balances_employee_uid"):
        op.create_index(
            "ix_employee_leave_balances_employee_uid",
            "employee_leave_balances",
            ["employee_uid"],
            unique=False,
        )

    if not index_exists("employee_leave_balances", "ix_employee_leave_balances_leave_type_uid"):
        op.create_index(
            "ix_employee_leave_balances_leave_type_uid",
            "employee_leave_balances",
            ["leave_type_uid"],
            unique=False,
        )

    if not index_exists("employee_leave_balances", "ix_employee_leave_balances_year"):
        op.create_index(
            "ix_employee_leave_balances_year",
            "employee_leave_balances",
            ["year"],
            unique=False,
        )

    # Recommended: only one balance row per employee + leave type + year
    if not constraint_exists(
        "uq_employee_leave_balances_employee_leave_type_year",
        table_name="employee_leave_balances",
    ):
        op.create_unique_constraint(
            "uq_employee_leave_balances_employee_leave_type_year",
            "employee_leave_balances",
            ["employee_uid", "leave_type_uid", "year"],
        )

    # --------------------------------------------------
    # 6. Create new leave_request
    # --------------------------------------------------
    if not table_exists("leave_request"):
        op.create_table(
            "leave_request",
            sa.Column(
                "uid",
                postgresql.UUID(as_uuid=True),
                primary_key=True,
                nullable=False,
                server_default=sa.text("gen_random_uuid()"),
            ),
            sa.Column("user_uid", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("employee_uid", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("leave_type_uid", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("start_date", sa.Date(), nullable=False),
            sa.Column("end_date", sa.Date(), nullable=False),
            sa.Column("applied_days", sa.Numeric(6, 2), nullable=False),
            sa.Column("reason", sa.Text(), nullable=True),
            sa.Column(
                "status",
                postgresql.ENUM(
                    *LEAVE_REQUEST_STATUS_VALUES,
                    name=LEAVE_REQUEST_STATUS_ENUM_NAME,
                    create_type=False,
                ),
                nullable=False,
                server_default=sa.text("'Pending'"),
            ),
            sa.Column(
                "approver_employee_uid",
                postgresql.UUID(as_uuid=True),
                nullable=True,
            ),
            sa.Column("reviewer_note", sa.Text(), nullable=True),
            sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
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
            sa.ForeignKeyConstraint(
                ["user_uid"],
                ["users.uid"],
                name="fk_leave_request_user_uid_users",
                ondelete="RESTRICT",
            ),
            sa.ForeignKeyConstraint(
                ["employee_uid"],
                ["employees.uid"],
                name="fk_leave_request_employee_uid_employees",
                ondelete="CASCADE",
            ),
            sa.ForeignKeyConstraint(
                ["leave_type_uid"],
                ["leave_types.uid"],
                name="fk_leave_request_leave_type_uid_leave_types",
                ondelete="RESTRICT",
            ),
            sa.ForeignKeyConstraint(
                ["approver_employee_uid"],
                ["employees.uid"],
                name="fk_leave_request_approver_employee_uid_employees",
                ondelete="SET NULL",
            ),
        )

    if not index_exists("leave_request", "ix_leave_request_user_uid"):
        op.create_index(
            "ix_leave_request_user_uid",
            "leave_request",
            ["user_uid"],
            unique=False,
        )

    if not index_exists("leave_request", "ix_leave_request_employee_uid"):
        op.create_index(
            "ix_leave_request_employee_uid",
            "leave_request",
            ["employee_uid"],
            unique=False,
        )

    if not index_exists("leave_request", "ix_leave_request_leave_type_uid"):
        op.create_index(
            "ix_leave_request_leave_type_uid",
            "leave_request",
            ["leave_type_uid"],
            unique=False,
        )

    if not index_exists("leave_request", "ix_leave_request_approver_employee_uid"):
        op.create_index(
            "ix_leave_request_approver_employee_uid",
            "leave_request",
            ["approver_employee_uid"],
            unique=False,
        )

    if not index_exists("leave_request", "ix_leave_request_start_date"):
        op.create_index(
            "ix_leave_request_start_date",
            "leave_request",
            ["start_date"],
            unique=False,
        )

    if not index_exists("leave_request", "ix_leave_request_end_date"):
        op.create_index(
            "ix_leave_request_end_date",
            "leave_request",
            ["end_date"],
            unique=False,
        )


def downgrade() -> None:
    """Downgrade schema."""

    # --------------------------------------------------
    # 1. Drop new leave_request
    # --------------------------------------------------
    if table_exists("leave_request"):
        if index_exists("leave_request", "ix_leave_request_end_date"):
            op.drop_index("ix_leave_request_end_date", table_name="leave_request")

        if index_exists("leave_request", "ix_leave_request_start_date"):
            op.drop_index("ix_leave_request_start_date", table_name="leave_request")

        if index_exists("leave_request", "ix_leave_request_approver_employee_uid"):
            op.drop_index("ix_leave_request_approver_employee_uid", table_name="leave_request")

        if index_exists("leave_request", "ix_leave_request_leave_type_uid"):
            op.drop_index("ix_leave_request_leave_type_uid", table_name="leave_request")

        if index_exists("leave_request", "ix_leave_request_employee_uid"):
            op.drop_index("ix_leave_request_employee_uid", table_name="leave_request")

        if index_exists("leave_request", "ix_leave_request_user_uid"):
            op.drop_index("ix_leave_request_user_uid", table_name="leave_request")

        op.drop_table("leave_request")

    # --------------------------------------------------
    # 2. Drop employee_leave_balances
    # --------------------------------------------------
    if table_exists("employee_leave_balances"):
        if constraint_exists(
            "uq_employee_leave_balances_employee_leave_type_year",
            table_name="employee_leave_balances",
        ):
            op.drop_constraint(
                "uq_employee_leave_balances_employee_leave_type_year",
                "employee_leave_balances",
                type_="unique",
            )

        if index_exists("employee_leave_balances", "ix_employee_leave_balances_year"):
            op.drop_index(
                "ix_employee_leave_balances_year",
                table_name="employee_leave_balances",
            )

        if index_exists("employee_leave_balances", "ix_employee_leave_balances_leave_type_uid"):
            op.drop_index(
                "ix_employee_leave_balances_leave_type_uid",
                table_name="employee_leave_balances",
            )

        if index_exists("employee_leave_balances", "ix_employee_leave_balances_employee_uid"):
            op.drop_index(
                "ix_employee_leave_balances_employee_uid",
                table_name="employee_leave_balances",
            )

        if index_exists("employee_leave_balances", "ix_employee_leave_balances_user_uid"):
            op.drop_index(
                "ix_employee_leave_balances_user_uid",
                table_name="employee_leave_balances",
            )

        op.drop_table("employee_leave_balances")

    # --------------------------------------------------
    # 3. Drop leave_types
    # --------------------------------------------------
    if table_exists("leave_types"):
        if constraint_exists("uq_leave_types_code", table_name="leave_types"):
            op.drop_constraint("uq_leave_types_code", "leave_types", type_="unique")

        if index_exists("leave_types", "ix_leave_types_user_uid"):
            op.drop_index("ix_leave_types_user_uid", table_name="leave_types")

        op.drop_table("leave_types")

    # --------------------------------------------------
    # 4. Drop holiday_calendar
    # --------------------------------------------------
    if table_exists("holiday_calendar"):
        if index_exists("holiday_calendar", "ix_holiday_calendar_user_uid"):
            op.drop_index("ix_holiday_calendar_user_uid", table_name="holiday_calendar")

        if index_exists("holiday_calendar", "ix_holiday_calendar_holiday_date"):
            op.drop_index("ix_holiday_calendar_holiday_date", table_name="holiday_calendar")

        op.drop_table("holiday_calendar")

    # --------------------------------------------------
    # 5. Drop new enums
    # --------------------------------------------------
    _drop_pg_enum_if_exists(LEAVE_REQUEST_STATUS_ENUM_NAME)
    _drop_pg_enum_if_exists(LEAVE_TYPE_CODE_ENUM_NAME)

    # --------------------------------------------------
    # 6. Recreate old leave_request table
    # --------------------------------------------------
    _create_pg_enum_if_not_exists(
        OLD_LEAVE_STATUS_ENUM_NAME,
        OLD_LEAVE_STATUS_VALUES,
    )

    if not table_exists("leave_request"):
        op.create_table(
            "leave_request",
            sa.Column(
                "uid",
                postgresql.UUID(as_uuid=True),
                primary_key=True,
                nullable=False,
                server_default=sa.text("gen_random_uuid()"),
            ),
            sa.Column("user_uid", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("employee_uid", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("leave_type", sa.String(length=80), nullable=False),
            sa.Column("start_date", sa.Date(), nullable=False),
            sa.Column("end_date", sa.Date(), nullable=False),
            sa.Column("days", sa.Integer(), nullable=False),
            sa.Column("reason", sa.Text(), nullable=True),
            sa.Column(
                "status",
                postgresql.ENUM(
                    *OLD_LEAVE_STATUS_VALUES,
                    name=OLD_LEAVE_STATUS_ENUM_NAME,
                    create_type=False,
                ),
                nullable=False,
                server_default=sa.text("'Pending'"),
            ),
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
            sa.ForeignKeyConstraint(
                ["employee_uid"],
                ["employees.uid"],
                name="fk_leave_request_employee_uid_employees_old",
                ondelete="CASCADE",
            ),
            sa.ForeignKeyConstraint(
                ["user_uid"],
                ["users.uid"],
                name="fk_leave_request_user_uid_users_old",
                ondelete="RESTRICT",
            ),
        )

    if not index_exists("leave_request", "ix_leave_request_user_uid"):
        op.create_index(
            "ix_leave_request_user_uid",
            "leave_request",
            ["user_uid"],
            unique=False,
        )

    if not index_exists("leave_request", "ix_leave_request_start_date"):
        op.create_index(
            "ix_leave_request_start_date",
            "leave_request",
            ["start_date"],
            unique=False,
        )

    if not index_exists("leave_request", "ix_leave_request_end_date"):
        op.create_index(
            "ix_leave_request_end_date",
            "leave_request",
            ["end_date"],
            unique=False,
        )

    if not index_exists("leave_request", "ix_leave_request_employee_uid"):
        op.create_index(
            "ix_leave_request_employee_uid",
            "leave_request",
            ["employee_uid"],
            unique=False,
        )