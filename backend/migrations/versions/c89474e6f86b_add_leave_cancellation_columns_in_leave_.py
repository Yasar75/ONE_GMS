"""add leave cancellation columns in leave_request table

Revision ID: c89474e6f86b
Revises: 8b447a0d3679
Create Date: 2026-04-02 13:25:54.191705

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "c89474e6f86b"
down_revision: Union[str, Sequence[str], None] = "8b447a0d3679"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


leave_cancellation_status_enum = postgresql.ENUM(
    "NoneRequested",
    "Pending",
    "Approved",
    "Rejected",
    name="leave_cancellation_status",
)


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    leave_cancellation_status_enum.create(bind, checkfirst=True)

    op.add_column(
        "leave_request",
        sa.Column(
            "cancellation_status",
            sa.Enum(
                "NoneRequested",
                "Pending",
                "Approved",
                "Rejected",
                name="leave_cancellation_status",
            ),
            nullable=False,
            server_default="NoneRequested",
        ),
    )
    op.add_column(
        "leave_request",
        sa.Column("cancellation_reason", sa.Text(), nullable=True),
    )
    op.add_column(
        "leave_request",
        sa.Column("cancellation_requested_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "leave_request",
        sa.Column("cancellation_reviewer_note", sa.Text(), nullable=True),
    )
    op.add_column(
        "leave_request",
        sa.Column("cancellation_reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "leave_request",
        sa.Column("cancellation_approver_employee_uid", postgresql.UUID(as_uuid=True), nullable=True),
    )

    op.create_index(
        op.f("ix_leave_request_cancellation_status"),
        "leave_request",
        ["cancellation_status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_leave_request_cancellation_approver_employee_uid"),
        "leave_request",
        ["cancellation_approver_employee_uid"],
        unique=False,
    )

    op.create_foreign_key(
        "fk_leave_request_cancellation_approver_employee_uid",
        "leave_request",
        "employees",
        ["cancellation_approver_employee_uid"],
        ["uid"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(
        "fk_leave_request_cancellation_approver_employee_uid",
        "leave_request",
        type_="foreignkey",
    )
    op.drop_index(
        op.f("ix_leave_request_cancellation_approver_employee_uid"),
        table_name="leave_request",
    )
    op.drop_index(
        op.f("ix_leave_request_cancellation_status"),
        table_name="leave_request",
    )

    op.drop_column("leave_request", "cancellation_approver_employee_uid")
    op.drop_column("leave_request", "cancellation_reviewed_at")
    op.drop_column("leave_request", "cancellation_reviewer_note")
    op.drop_column("leave_request", "cancellation_requested_at")
    op.drop_column("leave_request", "cancellation_reason")
    op.drop_column("leave_request", "cancellation_status")

    bind = op.get_bind()
    leave_cancellation_status_enum.drop(bind, checkfirst=True)