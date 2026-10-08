from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Placeholder used for rows that have no receiver set yet.
# Admins must update these via PATCH /payments/plans/{id}.
PLACEHOLDER_NAME  = "UNSET - Update via admin API"
PLACEHOLDER_PHONE = "0000000000"


def upgrade() -> None:
    conn = op.get_bind()

    # Fill NULLs before tightening the constraint
    conn.execute(
        text(
            "UPDATE plan_configs "
            "SET receiver_name = :name "
            "WHERE receiver_name IS NULL"
        ),
        {"name": PLACEHOLDER_NAME},
    )
    conn.execute(
        text(
            "UPDATE plan_configs "
            "SET receiver_phone = :phone "
            "WHERE receiver_phone IS NULL"
        ),
        {"phone": PLACEHOLDER_PHONE},
    )

    # Now apply NOT NULL
    op.alter_column(
        "plan_configs", "receiver_name",
        existing_type=sa.String(255),
        nullable=False,
    )
    op.alter_column(
        "plan_configs", "receiver_phone",
        existing_type=sa.String(50),
        nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "plan_configs", "receiver_phone",
        existing_type=sa.String(50),
        nullable=True,
    )
    op.alter_column(
        "plan_configs", "receiver_name",
        existing_type=sa.String(255),
        nullable=True,
    )
