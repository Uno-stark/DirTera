from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Add temporary VARCHAR column (nullable during migration)
    op.add_column(
        "subscriptions",
        sa.Column("plan_slug", sa.String(50), nullable=True),
    )

    # 2. Copy values from the enum column, casting to text
    conn.execute(
        sa.text("UPDATE subscriptions SET plan_slug = plan::text")
    )

    # 3. Make the new column NOT NULL now that it's populated
    op.alter_column("subscriptions", "plan_slug", nullable=False,
                    server_default="basic")

    # 4. Drop the old enum column
    op.drop_column("subscriptions", "plan")

    # 5. Rename plan_slug → plan
    op.alter_column("subscriptions", "plan_slug", new_column_name="plan")

    # 6. Drop the now-unused subscriptionplan enum type from Postgres
    #    (only exists if using PostgreSQL; skip silently on SQLite)
    try:
        conn.execute(sa.text("DROP TYPE IF EXISTS subscriptionplan"))
    except Exception:
        pass  # SQLite — no enum types to drop


def downgrade() -> None:
    conn = op.get_bind()

    # Recreate the enum type
    try:
        conn.execute(
            sa.text(
                "CREATE TYPE subscriptionplan AS ENUM "
                "('basic', 'standard', 'premium', 'premiered')"
            )
        )
    except Exception:
        pass  # already exists or SQLite

    # Add temporary enum column
    op.add_column(
        "subscriptions",
        sa.Column(
            "plan_enum",
            sa.Enum("basic", "standard", "premium", "premiered",
                    name="subscriptionplan"),
            nullable=True,
        ),
    )

    # Copy values back — rows with custom slugs default to "basic"
    conn.execute(
        sa.text(
            "UPDATE subscriptions "
            "SET plan_enum = CASE "
            "  WHEN plan IN ('basic','standard','premium','premiered') "
            "  THEN plan::subscriptionplan "
            "  ELSE 'basic'::subscriptionplan "
            "END"
        )
    )

    op.alter_column("subscriptions", "plan_enum", nullable=False)
    op.drop_column("subscriptions", "plan")
    op.alter_column("subscriptions", "plan_enum", new_column_name="plan")
