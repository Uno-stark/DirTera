from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Default plans — mirrors the old PLAN_PRICES / PLAN_DURATIONS constants
DEFAULT_PLANS = [
    # slug        label         description                                      amount    days  is_premiered  sort
    ("basic",     "Basic",      "Standard listing for 30 days.",                 500.0,    30,   False,        0),
    ("standard",  "Standard",   "Standard listing — best value for 3 months.",  1200.0,   90,   False,        1),
    ("premium",   "Premium",    "Standard listing for 6 months.",               2500.0,   180,  False,        2),
    ("premiered", "Premiered",  "Featured in the Premiered section for 30 days.",5000.0,  30,   True,         3),
]


def upgrade() -> None:
    # ── Create table ──────────────────────────────────────────────────────────
    op.create_table(
        "plan_configs",
        sa.Column("id",           sa.String(26),      primary_key=True, nullable=False),
        sa.Column("slug",         sa.String(50),      nullable=False),
        sa.Column("label",        sa.String(100),     nullable=False),
        sa.Column("description",  sa.Text,            nullable=True),
        sa.Column("amount",       sa.Numeric(12, 2),  nullable=False),
        sa.Column("currency",     sa.String(10),      nullable=False, server_default="ETB"),
        sa.Column("duration_days",sa.Integer,         nullable=False),
        sa.Column("is_premiered", sa.Boolean,         nullable=False, server_default="false"),
        sa.Column("is_active",    sa.Boolean,         nullable=False, server_default="true"),
        sa.Column("sort_order",   sa.Integer,         nullable=False, server_default="0"),
        sa.Column("created_at",   sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at",   sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("slug", name="uq_plan_configs_slug"),
    )
    op.create_index("ix_plan_configs_slug",      "plan_configs", ["slug"])
    op.create_index("ix_plan_configs_is_active", "plan_configs", ["is_active"])

    # ── Seed default plans ────────────────────────────────────────────────────
    conn = op.get_bind()

    from ulid import ULID

    for slug, label, description, amount, duration_days, is_premiered, sort_order in DEFAULT_PLANS:
        conn.execute(
            text(
                "INSERT INTO plan_configs "
                "  (id, slug, label, description, amount, currency, duration_days, "
                "   is_premiered, is_active, sort_order, created_at, updated_at) "
                "VALUES "
                "  (:id, :slug, :label, :desc, :amount, 'ETB', :days, "
                "   :premiered, true, :sort, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) "
                "ON CONFLICT (slug) DO NOTHING"
            ),
            {
                "id":       str(ULID()),
                "slug":     slug,
                "label":    label,
                "desc":     description,
                "amount":   amount,
                "days":     duration_days,
                "premiered": is_premiered,
                "sort":     sort_order,
            },
        )


def downgrade() -> None:
    op.drop_index("ix_plan_configs_is_active", "plan_configs")
    op.drop_index("ix_plan_configs_slug",      "plan_configs")
    op.drop_table("plan_configs")
