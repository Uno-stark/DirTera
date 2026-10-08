from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add new column
    op.add_column(
        "websites",
        sa.Column("image_urls", sa.Text, nullable=True),
    )

    # 2. Migrate existing thumbnail_url values → image_urls
    conn = op.get_bind()
    conn.execute(
        sa.text(
            "UPDATE websites "
            "SET image_urls = thumbnail_url "
            "WHERE thumbnail_url IS NOT NULL AND thumbnail_url != ''"
        )
    )

    # 3. Drop old column
    op.drop_column("websites", "thumbnail_url")


def downgrade() -> None:
    op.add_column(
        "websites",
        sa.Column("thumbnail_url", sa.Text, nullable=True),
    )
    conn = op.get_bind()
    # Restore first image as thumbnail_url
    conn.execute(
        sa.text(
            "UPDATE websites "
            "SET thumbnail_url = SPLIT_PART(image_urls, ',', 1) "
            "WHERE image_urls IS NOT NULL AND image_urls != ''"
        )
    )
    op.drop_column("websites", "image_urls")
