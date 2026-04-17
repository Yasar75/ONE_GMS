"""Clean up duplicate Delivery roles.

Revision ID: 9a1b2c3d4e5f
Revises: 4e5f6a7b8c9d
Create Date: 2026-04-17 14:05:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from migrations.helpers import table_exists


# revision identifiers, used by Alembic.
revision: str = "9a1b2c3d4e5f"
down_revision: Union[str, Sequence[str], None] = "4e5f6a7b8c9d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    if not table_exists("roles"):
        return

    conn = op.get_bind()
    role_rows = conn.execute(
        sa.text(
            """
            SELECT uid::text AS uid, role_name
            FROM roles
            WHERE LOWER(TRIM(role_name)) IN ('delivery', 'delivary')
            ORDER BY
                CASE WHEN LOWER(TRIM(role_name)) = 'delivery' THEN 0 ELSE 1 END,
                created_at NULLS FIRST,
                updated_at NULLS FIRST
            """
        )
    ).fetchall()

    if not role_rows:
        return

    keep_uid = str(role_rows[0].uid)
    duplicate_uids = [str(row.uid) for row in role_rows[1:]]

    for duplicate_uid in duplicate_uids:
        if table_exists("users"):
            conn.execute(
                sa.text(
                    """
                    UPDATE users
                    SET role_id = CAST(:keep_uid AS UUID)
                    WHERE role_id = CAST(:duplicate_uid AS UUID)
                    """
                ),
                {"keep_uid": keep_uid, "duplicate_uid": duplicate_uid},
            )

        if table_exists("employees"):
            conn.execute(
                sa.text(
                    """
                    UPDATE employees
                    SET role_type = CAST(:keep_uid AS UUID)
                    WHERE role_type = CAST(:duplicate_uid AS UUID)
                    """
                ),
                {"keep_uid": keep_uid, "duplicate_uid": duplicate_uid},
            )

        conn.execute(
            sa.text(
                """
                DELETE FROM roles
                WHERE uid = CAST(:duplicate_uid AS UUID)
                """
            ),
            {"duplicate_uid": duplicate_uid},
        )

    conn.execute(
        sa.text(
            """
            UPDATE roles
            SET role_name = 'Delivery'
            WHERE uid = CAST(:keep_uid AS UUID)
            """
        ),
        {"keep_uid": keep_uid},
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Data cleanup migration; no-op downgrade.
    return
