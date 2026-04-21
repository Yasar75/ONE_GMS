"""create Table employees, attendance, leave_request (+ employee sub tables)

Revision ID: 568ba3d076d6
Revises: 21c25c53eeae
Create Date: 2026-02-22 17:07:20.272934
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg

from migrations.helpers import (
    table_exists,
    index_exists,
    is_postgres,
)

# revision identifiers, used by Alembic.
revision: str = "568ba3d076d6"
down_revision: Union[str, Sequence[str], None] = "21c25c53eeae"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _q_ident(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def _create_pg_enum_if_not_exists(enum_name: str, values: list[str]) -> None:
    if not is_postgres():
        return

    enum_ident = _q_ident(enum_name)
    enum_name_lit = enum_name.replace("'", "''")
    vals = ", ".join("'" + v.replace("'", "''") + "'" for v in values)

    op.execute(
        sa.text(
            f"""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_type WHERE typname = '{enum_name_lit}'
                ) THEN
                    CREATE TYPE {enum_ident} AS ENUM ({vals});
                END IF;
            END$$;
            """
        )
    )


def _drop_pg_enum_if_exists(enum_name: str) -> None:
    if not is_postgres():
        return
    op.execute(sa.text(f'DROP TYPE IF EXISTS "{enum_name}";'))


def upgrade() -> None:
    # -------------------------
    # 1) ENUM types (Postgres)
    # -------------------------
    _create_pg_enum_if_not_exists("employee_status", ["Active", "Inactive", "Resigned", "Terminated"])
    _create_pg_enum_if_not_exists("employee_type", ["FullTime", "PartTime", "Contract", "Intern"])
    _create_pg_enum_if_not_exists("inout_status", ["OnTime", "Late", "Early", "Missing"])
    _create_pg_enum_if_not_exists("attendance_status", ["Present", "Absent", "HalfDay", "Leave"])
    _create_pg_enum_if_not_exists("leave_status", ["Pending", "Approved", "Rejected", "Cancelled"])

    # -------------------------
    # 2) employees
    # -------------------------
    if not table_exists("employees"):
        op.create_table(
            "employees",
            sa.Column("uid", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("user_uid", pg.UUID(as_uuid=True), sa.ForeignKey("users.uid", ondelete="RESTRICT"), nullable=False),
            sa.Column("employee_code", sa.VARCHAR(20), nullable=False),
            sa.Column("name", sa.VARCHAR(120), nullable=False),
            sa.Column("position", sa.VARCHAR(120), nullable=True),
            sa.Column("department", sa.VARCHAR(120), nullable=True),
            sa.Column("email", sa.VARCHAR(255), nullable=True),
            sa.Column("phone", sa.VARCHAR(50), nullable=True),
            sa.Column("join_date", sa.DATE(), nullable=True),
            sa.Column(
                "status",
                pg.ENUM(name="employee_status", create_type=False),
                nullable=False,
                server_default="Active",
            ),
            sa.Column("birth_date", sa.DATE(), nullable=True),
            sa.Column("address", sa.Text(), nullable=True),
            sa.Column("emergency_contact", sa.Text(), nullable=True),
            sa.Column(
                "employee_type",
                pg.ENUM(name="employee_type", create_type=False),
                nullable=True,
            ),
            sa.Column("work_location", sa.VARCHAR(120), nullable=True),
            sa.Column(
                "manager_employee_uid",
                pg.UUID(as_uuid=True),
                sa.ForeignKey("employees.uid", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )

    if table_exists("employees"):
        if not index_exists("employees", "ix_employees_user_uid"):
            op.create_index("ix_employees_user_uid", "employees", ["user_uid"])
        if not index_exists("employees", "ix_employees_manager_employee_uid"):
            op.create_index("ix_employees_manager_employee_uid", "employees", ["manager_employee_uid"])
        if not index_exists("employees", "ix_employees_employee_code"):
            op.create_index("ix_employees_employee_code", "employees", ["employee_code"], unique=True)
        if not index_exists("employees", "ix_employees_email"):
            op.create_index("ix_employees_email", "employees", ["email"], unique=True)

    # -------------------------
    # 3) employee_skills
    # -------------------------
    if not table_exists("employee_skills"):
        op.create_table(
            "employee_skills",
            sa.Column("uid", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("user_uid", pg.UUID(as_uuid=True), sa.ForeignKey("users.uid", ondelete="RESTRICT"), nullable=False),
            sa.Column("employee_uid", pg.UUID(as_uuid=True), sa.ForeignKey("employees.uid", ondelete="CASCADE"), nullable=False),
            sa.Column("skill", sa.VARCHAR(80), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint("employee_uid", "skill", name="uq_employee_skills_employee_uid_skill"),
        )
    if table_exists("employee_skills"):
        if not index_exists("employee_skills", "ix_employee_skills_user_uid"):
            op.create_index("ix_employee_skills_user_uid", "employee_skills", ["user_uid"])
        if not index_exists("employee_skills", "ix_employee_skills_employee_uid"):
            op.create_index("ix_employee_skills_employee_uid", "employee_skills", ["employee_uid"])

    # -------------------------
    # 4) employee_education
    # -------------------------
    if not table_exists("employee_education"):
        op.create_table(
            "employee_education",
            sa.Column("uid", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("user_uid", pg.UUID(as_uuid=True), sa.ForeignKey("users.uid", ondelete="RESTRICT"), nullable=False),
            sa.Column("employee_uid", pg.UUID(as_uuid=True), sa.ForeignKey("employees.uid", ondelete="CASCADE"), nullable=False),
            sa.Column("degree", sa.Text(), nullable=False),
            sa.Column("institution", sa.Text(), nullable=False),
            sa.Column("year", sa.SmallInteger(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
    if table_exists("employee_education"):
        if not index_exists("employee_education", "ix_employee_education_user_uid"):
            op.create_index("ix_employee_education_user_uid", "employee_education", ["user_uid"])
        if not index_exists("employee_education", "ix_employee_education_employee_uid"):
            op.create_index("ix_employee_education_employee_uid", "employee_education", ["employee_uid"])

    # -------------------------
    # 5) employee_documents
    # -------------------------
    if not table_exists("employee_documents"):
        op.create_table(
            "employee_documents",
            sa.Column("uid", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("user_uid", pg.UUID(as_uuid=True), sa.ForeignKey("users.uid", ondelete="RESTRICT"), nullable=False),
            sa.Column("employee_uid", pg.UUID(as_uuid=True), sa.ForeignKey("employees.uid", ondelete="CASCADE"), nullable=False),
            sa.Column("name", sa.VARCHAR(255), nullable=False),
            sa.Column("upload_date", sa.DATE(), nullable=True),
            sa.Column("file_url", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
    if table_exists("employee_documents"):
        if not index_exists("employee_documents", "ix_employee_documents_user_uid"):
            op.create_index("ix_employee_documents_user_uid", "employee_documents", ["user_uid"])
        if not index_exists("employee_documents", "ix_employee_documents_employee_uid"):
            op.create_index("ix_employee_documents_employee_uid", "employee_documents", ["employee_uid"])

    # -------------------------
    # 6) employee_achievements
    # -------------------------
    if not table_exists("employee_achievements"):
        op.create_table(
            "employee_achievements",
            sa.Column("uid", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("user_uid", pg.UUID(as_uuid=True), sa.ForeignKey("users.uid", ondelete="RESTRICT"), nullable=False),
            sa.Column("employee_uid", pg.UUID(as_uuid=True), sa.ForeignKey("employees.uid", ondelete="CASCADE"), nullable=False),
            sa.Column("title", sa.VARCHAR(200), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("achievement_date", sa.DATE(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
    if table_exists("employee_achievements"):
        if not index_exists("employee_achievements", "ix_employee_achievements_user_uid"):
            op.create_index("ix_employee_achievements_user_uid", "employee_achievements", ["user_uid"])
        if not index_exists("employee_achievements", "ix_employee_achievements_employee_uid"):
            op.create_index("ix_employee_achievements_employee_uid", "employee_achievements", ["employee_uid"])

    # -------------------------
    # 7) attendance
    # -------------------------
    if not table_exists("attendance"):
        op.create_table(
            "attendance",
            sa.Column("uid", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("user_uid", pg.UUID(as_uuid=True), sa.ForeignKey("users.uid", ondelete="RESTRICT"), nullable=False),
            sa.Column("employee_uid", pg.UUID(as_uuid=True), sa.ForeignKey("employees.uid", ondelete="CASCADE"), nullable=False),
            sa.Column("attendance_date", sa.DATE(), nullable=False),
            sa.Column("check_in", sa.Time(), nullable=True),
            sa.Column("check_out", sa.Time(), nullable=True),
            sa.Column("check_in_status", pg.ENUM(name="inout_status", create_type=False), nullable=True),
            sa.Column("check_out_status", pg.ENUM(name="inout_status", create_type=False), nullable=True),
            sa.Column("working_hours", sa.Numeric(5, 2), nullable=False, server_default="0"),
            sa.Column(
                "status",
                pg.ENUM(name="attendance_status", create_type=False),
                nullable=False,
                server_default="Present",
            ),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint(
                "employee_uid",
                "attendance_date",
                name="uq_attendance_employee_uid_attendance_date",
            ),
        )
    if table_exists("attendance"):
        if not index_exists("attendance", "ix_attendance_user_uid"):
            op.create_index("ix_attendance_user_uid", "attendance", ["user_uid"])
        if not index_exists("attendance", "ix_attendance_employee_uid"):
            op.create_index("ix_attendance_employee_uid", "attendance", ["employee_uid"])
        if not index_exists("attendance", "ix_attendance_attendance_date"):
            op.create_index("ix_attendance_attendance_date", "attendance", ["attendance_date"])

    # -------------------------
    # 8) leave_request
    # -------------------------
    if not table_exists("leave_request"):
        op.create_table(
            "leave_request",
            sa.Column("uid", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("user_uid", pg.UUID(as_uuid=True), sa.ForeignKey("users.uid", ondelete="RESTRICT"), nullable=False),
            sa.Column("employee_uid", pg.UUID(as_uuid=True), sa.ForeignKey("employees.uid", ondelete="CASCADE"), nullable=False),
            sa.Column("leave_type", sa.VARCHAR(80), nullable=False),
            sa.Column("start_date", sa.DATE(), nullable=False),
            sa.Column("end_date", sa.DATE(), nullable=False),
            sa.Column("days", sa.Integer(), nullable=False),
            sa.Column("reason", sa.Text(), nullable=True),
            sa.Column(
                "status",
                pg.ENUM(name="leave_status", create_type=False),
                nullable=False,
                server_default="Pending",
            ),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
    if table_exists("leave_request"):
        if not index_exists("leave_request", "ix_leave_request_user_uid"):
            op.create_index("ix_leave_request_user_uid", "leave_request", ["user_uid"])
        if not index_exists("leave_request", "ix_leave_request_employee_uid"):
            op.create_index("ix_leave_request_employee_uid", "leave_request", ["employee_uid"])
        if not index_exists("leave_request", "ix_leave_request_start_date"):
            op.create_index("ix_leave_request_start_date", "leave_request", ["start_date"])
        if not index_exists("leave_request", "ix_leave_request_end_date"):
            op.create_index("ix_leave_request_end_date", "leave_request", ["end_date"])


def downgrade() -> None:
    if table_exists("leave_request"):
        op.drop_table("leave_request")

    if table_exists("attendance"):
        op.drop_table("attendance")

    if table_exists("employee_achievements"):
        op.drop_table("employee_achievements")

    if table_exists("employee_documents"):
        op.drop_table("employee_documents")

    if table_exists("employee_education"):
        op.drop_table("employee_education")

    if table_exists("employee_skills"):
        op.drop_table("employee_skills")

    if table_exists("employees"):
        op.drop_table("employees")

    _drop_pg_enum_if_exists("leave_status")
    _drop_pg_enum_if_exists("attendance_status")
    _drop_pg_enum_if_exists("inout_status")
    _drop_pg_enum_if_exists("employee_type")
    _drop_pg_enum_if_exists("employee_status")