from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "token_blocklist",
        sa.Column("id",         sa.String(26),               primary_key=True, nullable=False),
        sa.Column("jti",        sa.String(36),               nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True),  nullable=False),
    )
    op.create_index("ix_token_blocklist_jti",        "token_blocklist", ["jti"],        unique=True)
    op.create_index("ix_token_blocklist_expires_at", "token_blocklist", ["expires_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_token_blocklist_expires_at", table_name="token_blocklist")
    op.drop_index("ix_token_blocklist_jti",        table_name="token_blocklist")
    op.drop_table("token_blocklist")
