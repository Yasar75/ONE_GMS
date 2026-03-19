"""init db user and roles table

Revision ID: 21c25c53eeae
Revises:
Create Date: 2026-02-21 23:46:24.246489
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# ✅ use your helpers
from migrations.helpers import (
    table_exists,
    column_exists,
    add_column_if_not_exists,
)

# revision identifiers, used by Alembic.
revision: str = "21c25c53eeae"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Keep constraint names explicit so they can be managed safely later
ROLE_UQ_NAME = "uq_roles_role_name"
USER_UQ_EMAIL = "uq_users_email"
USER_FK_ROLE = "fk_users_role_id_roles"


def upgrade() -> None:
    """Upgrade schema."""

    # -----------------------
    # ROLES
    # -----------------------
    if not table_exists("roles"):
        op.create_table(
            "roles",
            sa.Column("uid", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("role_name", sa.VARCHAR(), nullable=False),
            sa.Column("description", sa.VARCHAR(), nullable=True),
            sa.Column("permissions", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
            sa.Column("created_at", postgresql.TIMESTAMP(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
            sa.PrimaryKeyConstraint("uid", name="pk_roles"),
            sa.UniqueConstraint("role_name", name=ROLE_UQ_NAME),
        )
    else:
        # If table exists, ensure expected columns exist (safe “repair”)
        add_column_if_not_exists("roles", sa.Column("role_name", sa.VARCHAR(), nullable=False))
        add_column_if_not_exists("roles", sa.Column("description", sa.VARCHAR(), nullable=True))
        add_column_if_not_exists(
            "roles",
            sa.Column("permissions", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        )
        add_column_if_not_exists("roles", sa.Column("created_at", postgresql.TIMESTAMP(), nullable=True))
        add_column_if_not_exists("roles", sa.Column("updated_at", sa.DateTime(), nullable=False))
        add_column_if_not_exists("roles", sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True))

        # NOTE: helper.py currently doesn't have create_unique_constraint_if_not_exists().
        # If you want fully idempotent constraint creation here, add that helper.
        # Otherwise, keep constraints managed by later dedicated migrations.

    # -----------------------
    # USERS
    # -----------------------
    if not table_exists("users"):
        op.create_table(
            "users",
            sa.Column("uid", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("username", sa.VARCHAR(), nullable=False),
            sa.Column("email", sa.VARCHAR(), nullable=False),
            sa.Column("first_name", sa.VARCHAR(), nullable=True),
            sa.Column("last_name", sa.VARCHAR(), nullable=True),
            sa.Column("role_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("is_verified", sa.Boolean(), nullable=False),
            sa.Column("password_hash", sa.VARCHAR(), nullable=False),
            sa.Column("created_at", postgresql.TIMESTAMP(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("uid", name="pk_users"),
            sa.UniqueConstraint("email", name=USER_UQ_EMAIL),
            sa.ForeignKeyConstraint(["role_id"], ["roles.uid"], name=USER_FK_ROLE),
        )
    else:
        add_column_if_not_exists("users", sa.Column("username", sa.VARCHAR(), nullable=False))
        add_column_if_not_exists("users", sa.Column("email", sa.VARCHAR(), nullable=False))
        add_column_if_not_exists("users", sa.Column("first_name", sa.VARCHAR(), nullable=True))
        add_column_if_not_exists("users", sa.Column("last_name", sa.VARCHAR(), nullable=True))
        add_column_if_not_exists("users", sa.Column("role_id", postgresql.UUID(as_uuid=True), nullable=False))
        add_column_if_not_exists("users", sa.Column("is_verified", sa.Boolean(), nullable=False))
        add_column_if_not_exists("users", sa.Column("password_hash", sa.VARCHAR(), nullable=False))
        add_column_if_not_exists("users", sa.Column("created_at", postgresql.TIMESTAMP(), nullable=True))
        add_column_if_not_exists("users", sa.Column("updated_at", sa.DateTime(), nullable=False))

        # Same note as above re: idempotent constraints (unique/fk).
        # If constraints might already exist with different names, handle via dedicated migration.

    # Optional: if your old migrations created UUID columns using sa.Uuid()/sa.UUID inconsistently,
    # you can add safe type-normalization migrations later (separate revision).


def downgrade() -> None:
    """Downgrade schema."""
    # Drop in reverse dependency order, and only if tables exist
    if table_exists("users"):
        op.drop_table("users")
    if table_exists("roles"):
        op.drop_table("roles")