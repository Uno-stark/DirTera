from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "plan_configs",
        sa.Column("receiver_name",  sa.String(255), nullable=True),
    )
    op.add_column(
        "plan_configs",
        sa.Column("receiver_phone", sa.String(50),  nullable=True),
    )


def downgrade() -> None:
    op.drop_column("plan_configs", "receiver_phone")
    op.drop_column("plan_configs", "receiver_name")
