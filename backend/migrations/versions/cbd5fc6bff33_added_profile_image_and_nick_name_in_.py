"""Added profile_image and nick_name in employee table

Revision ID: cbd5fc6bff33
Revises: d7865fc602976
Create Date: 2026-03-20 16:09:46.563364

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op
from migrations.helpers import (
    add_column_if_not_exists,
    drop_column_if_exists,
)

# revision identifiers, used by Alembic.
revision: str = "cbd5fc6bff33"
down_revision: Union[str, Sequence[str], None] = "d7865f602976"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    add_column_if_not_exists(
        "employees",
        sa.Column("nick_name", sa.String(length=120), nullable=True),
    )
    add_column_if_not_exists(
        "employees",
        sa.Column("profile_image", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    drop_column_if_exists("employees", "profile_image")
    drop_column_if_exists("employees", "nick_name")